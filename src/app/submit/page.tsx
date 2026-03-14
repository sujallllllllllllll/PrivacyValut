"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const schema = z.object({
  userName: z.string().min(2, "Full name is required"),
  userEmail: z.string().email("Invalid email address"),
  userPhone: z.string().optional(),
  requestType: z.enum(["access", "correction", "erasure"]),
  requestDetails: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SubmitPage() {
  const [successData, setSuccessData] = useState<{ token: string; deadline?: string | null; email: string } | null>(null);
  const [serverError, setServerError] = useState("");
  const [isPending, setIsPending] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Saved from DB record created during OTP step
  const [tempRequestId, setTempRequestId] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempDeadline, setTempDeadline] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { userName: "", userEmail: "", userPhone: "", requestType: "access", requestDetails: "" },
  });

  const watchPhone = form.watch("userPhone");

  // Step 1: Create a temp pending record just to attach OTP, then send OTP
  async function handleSendOtp() {
    const values = form.getValues();
    if (!values.userPhone || values.userPhone.length < 10) {
      setServerError("Please enter a valid phone number.");
      return;
    }
    // Validate name and email are filled before sending OTP
    const valid = await form.trigger(["userName", "userEmail"]);
    if (!valid) return;

    setIsSendingOtp(true);
    setServerError("");

    try {
      // Create temp pending record in DB to attach OTP to
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create request");

      setTempRequestId(data.id);
      setTempToken(data.token);
      setTempDeadline(data.deadline ?? null);

      // Send OTP to phone
      const otpRes = await fetch("/api/dsar/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: data.id, phone: values.userPhone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.message || "Failed to send OTP");

      setOtpSent(true);
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp() {
    if (otpValue.length !== 6) {
      setServerError("OTP must be 6 digits.");
      return;
    }
    setIsVerifying(true);
    setServerError("");
    try {
      const res = await fetch("/api/dsar/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: tempRequestId, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP");
      setPhoneVerified(true);
      setOtpSent(false);
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to verify OTP.");
    } finally {
      setIsVerifying(false);
    }
  }

  // Step 3: Final submit — only called when user clicks "Submit Request"
  async function onSubmit(values: FormValues) {
    if (values.userPhone && values.userPhone.length >= 10 && !phoneVerified) {
      setServerError("Please verify your phone number before submitting.");
      return;
    }

    setIsPending(true);
    setServerError("");

    try {
      // Phone was verified — record already exists in DB, token already saved in state
      if (tempRequestId && phoneVerified && tempToken) {
        setSuccessData({ token: tempToken, deadline: tempDeadline, email: values.userEmail });
        return;
      }

      // No phone — create fresh record now on submit click
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setSuccessData({ token: data.token, deadline: data.deadline, email: values.userEmail });
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to submit request.");
    } finally {
      setIsPending(false);
    }
  }

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="border-green-200">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
            <CardTitle className="text-2xl">Request Submitted Successfully</CardTitle>
            <CardDescription className="text-base mt-2">Your request has been received.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-8 pt-6">
            <div className="bg-secondary/50 p-8 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-3">Your Tracking Token</p>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-primary tracking-wider">{successData.token}</div>
              <p className="text-sm text-muted-foreground mt-4">Save this token to track your request status.</p>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100 text-left">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></svg>
                Action Required: Verify Your Email
              </h3>
              <p className="text-sm text-blue-700">
                A verification link has been sent to <strong>{successData.email}</strong>.
                Your request is <span className="font-semibold">Pending — Awaiting Your Email Verification</span>.
                It will not be reviewed by our team until you click the link.
              </p>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-left text-sm text-amber-800">
              <strong>What happens next?</strong>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>You verify your email → status becomes <strong>Submitted</strong></li>
                <li>Our team reviews it → status becomes <strong>Under Review</strong></li>
                <li>We process your request → status becomes <strong>Processing</strong></li>
                <li>Request resolved → status becomes <strong>Completed</strong></li>
              </ol>
            </div>

            {successData.deadline && (
              <div className="text-sm">
                <span className="text-muted-foreground">Estimated completion by: </span>
                <span className="font-semibold">{new Date(successData.deadline).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/track"><Button>Track Request</Button></Link>
              <Link href="/"><Button variant="outline">Return Home</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Submit a Request</h1>
        <p className="text-muted-foreground">Fill out the form below to exercise your data rights under the DPDP Act.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userName">Full Name *</Label>
                <Input id="userName" placeholder="John Doe" {...form.register("userName")} className={form.formState.errors.userName ? "border-destructive" : ""} />
                {form.formState.errors.userName && <p className="text-sm text-destructive">{form.formState.errors.userName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email Address *</Label>
                <Input id="userEmail" type="email" placeholder="john@example.com" {...form.register("userEmail")} className={form.formState.errors.userEmail ? "border-destructive" : ""} />
                {form.formState.errors.userEmail && <p className="text-sm text-destructive">{form.formState.errors.userEmail.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userPhone">Phone Number (Optional)</Label>

                {/* Phone input row */}
                <div className="flex gap-2">
                  <Input
                    id="userPhone"
                    placeholder="+91 98765 43210"
                    disabled={phoneVerified || otpSent}
                    {...form.register("userPhone")}
                  />
                  {watchPhone && watchPhone.length >= 10 && !phoneVerified && !otpSent && (
                    <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isSendingOtp}>
                      {isSendingOtp ? "Sending..." : "Send OTP"}
                    </Button>
                  )}
                  {phoneVerified && (
                    <div className="flex items-center text-green-600 bg-green-50 px-3 rounded-md text-sm font-medium border border-green-200 whitespace-nowrap">
                      ✓ Verified
                    </div>
                  )}
                </div>

                {/* OTP input — always visible once OTP is sent, until verified */}
                {otpSent && !phoneVerified && (
                  <div className="mt-3 p-4 bg-blue-50/50 rounded-md border border-blue-100 space-y-3">
                    <p className="text-sm text-blue-700 font-medium">Enter the 6-digit OTP sent to your phone</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter 6-digit OTP"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        className="bg-background font-mono tracking-widest text-center text-lg"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifying || otpValue.length !== 6}
                      >
                        {isVerifying ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 disabled:opacity-50"
                    >
                      {isSendingOtp ? "Sending..." : "Resend OTP"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestType">Request Type *</Label>
                <select
                  id="requestType"
                  className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("requestType")}
                >
                  <option value="access">Right to Access</option>
                  <option value="correction">Right to Correction</option>
                  <option value="erasure">Right to Erasure</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestDetails">Additional Details (Optional)</Label>
              <Textarea id="requestDetails" placeholder="Provide any specific context..." className="min-h-[120px]" {...form.register("requestDetails")} />
            </div>

            {serverError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-sm">{serverError}</div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || (!!watchPhone && watchPhone.length >= 10 && !phoneVerified)}
            >
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>

            {watchPhone && watchPhone.length >= 10 && !phoneVerified && (
              <p className="text-center text-sm text-amber-600">⚠ Verify your phone number to enable submission</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
