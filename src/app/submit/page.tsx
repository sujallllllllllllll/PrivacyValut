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
  const [successData, setSuccessData] = useState<{ token: string; deadline?: string | null } | null>(null);
  const [serverError, setServerError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { userName: "", userEmail: "", userPhone: "", requestType: "access", requestDetails: "" },
  });

  async function onSubmit(values: FormValues) {
    setIsPending(true);
    setServerError("");
    try {
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setSuccessData({ token: data.token, deadline: data.deadline });
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to submit request. Please try again.");
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
            <CardDescription className="text-base mt-2">Your request has been received and is being processed.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-8 pt-6">
            <div className="bg-secondary/50 p-8 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-3">Your Tracking Token</p>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-primary tracking-wider">{successData.token}</div>
              <p className="text-sm text-muted-foreground mt-4">Please save this token. You will need it to track your request status.</p>
            </div>
            {successData.deadline && (
              <div className="text-sm">
                <span className="text-muted-foreground">Estimated completion by: </span>
                <span className="font-semibold">{new Date(successData.deadline).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/track"><Button>Track Request Now</Button></Link>
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
                <Input id="userPhone" placeholder="+91 98765 43210" {...form.register("userPhone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestType">Request Type *</Label>
                <select id="requestType" className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("requestType")}>
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
            <Button type="submit" className="w-full" size="lg" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
