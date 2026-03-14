"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CertData = {
  cert_id: string;
  dsar_token: string;
  request_type: string;
  citizen_name: string;
  completed_at: string;
  cert_hash: string;
  cert_issued_at: string;
  issuer: string;
};

async function loadJsPDF() {
  // Dynamic import so it only loads client-side
  const { jsPDF } = await import("jspdf");
  return jsPDF;
}

export function CertificateDownload({ certId }: { certId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function downloadPDF() {
    setIsGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/certificate/${certId}`);
      if (!res.ok) throw new Error("Certificate not found");
      const cert: CertData = await res.json();

      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageW - margin * 2;

      // --- Header ---
      doc.setFillColor(22, 101, 52); // green-800
      doc.rect(0, 0, pageW, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("PrivacyVault DPDP Compliance Platform", margin, 14);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("DATA SUBJECT REQUEST FULFILLMENT CERTIFICATE", margin, 25);

      // --- Title ---
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const typeLabel =
        cert.request_type === "erasure" ? "Data Erasure" :
        cert.request_type === "correction" ? "Data Correction" : "Data Access";
      doc.text(`${typeLabel.toUpperCase()} — FULFILMENT CERTIFICATE`, margin, 48);

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 52, margin + contentW, 52);

      // --- Details Grid ---
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      const col2 = pageW / 2 + 5;

      const fields: [string, string, string, string][] = [
        ["CITIZEN NAME", cert.citizen_name, "REQUEST TOKEN", cert.dsar_token],
        ["REQUEST TYPE", typeLabel, "FULFILLED ON", new Date(cert.completed_at).toLocaleString("en-IN")],
        ["CERTIFICATE ID", cert.cert_id.substring(0, 18) + "...", "CERT ISSUED", new Date(cert.cert_issued_at).toLocaleString("en-IN")],
      ];

      let y = 62;
      for (const [l1, v1, l2, v2] of fields) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(l1, margin, y);
        doc.text(l2, col2, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(v1, margin, y + 5);
        doc.text(v2, col2, y + 5);
        y += 15;
      }

      // --- Hash Section ---
      y += 5;
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentW, 30, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("SHA-256 FULFILLMENT HASH (CRYPTOGRAPHIC FINGERPRINT)", margin + 4, y + 8);
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      // Split hash across two lines if needed
      const hashLine1 = cert.cert_hash.substring(0, 64);
      const hashLine2 = cert.cert_hash.substring(64);
      doc.text(hashLine1, margin + 4, y + 16);
      if (hashLine2) doc.text(hashLine2, margin + 4, y + 22);
      y += 40;

      // --- Verify URL ---
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(22, 101, 52);
      const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${certId}`;
      doc.text(`Verify online: ${verifyUrl}`, margin, y);
      y += 10;

      // --- Legal Notice ---
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        "This certificate was generated in compliance with the Digital Personal Data Protection Act 2023 (India).",
        margin, y, { maxWidth: contentW }
      );
      doc.text("DPDP Act 2023 — Sections 11, 12, 13 | Issuer: " + cert.issuer, margin, y + 8);

      // --- Footer border ---
      doc.setDrawColor(22, 101, 52);
      doc.setLineWidth(1);
      doc.rect(margin, 36, contentW, y + 16, "S");

      doc.save(`PrivacyVault-Certificate-${cert.dsar_token}.pdf`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={downloadPDF}
        disabled={isGenerating}
        className="w-full bg-green-700 hover:bg-green-800 text-white"
      >
        {isGenerating ? (
          <>⏳ Generating Certificate…</>
        ) : (
          <>📄 Download Fulfillment Certificate (PDF)</>
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Cryptographically signed · DPDP Act 2023 compliant
      </p>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}
