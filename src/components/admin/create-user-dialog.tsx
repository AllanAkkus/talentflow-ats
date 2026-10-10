"use client";

import { Check, Copy, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Field,
  FormError,
  SelectInput,
  TextInput,
} from "@/components/ui/form";
import { Spinner } from "@/components/ui/primitives";
import type { Organization, UserRole } from "@/types/database";

type CreatedUser = {
  email: string;
  password: string;
  role: UserRole;
  organizationName: string | null;
};

/**
 * Admin form for creating accounts.
 *
 * Posts to /api/admin/users rather than using a server action: the endpoint is
 * part of the product surface (it is what an admin tool or a future invite flow
 * would call), and keeping it as a route handler makes its auth checks easy to
 * exercise directly. The generated password is shown once after success so the
 * admin can hand it over; it is never stored anywhere by TalentFlow.
 */
export function CreateUserDialog({
  organizations,
}: {
  organizations: Organization[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("customer");
  const [orgMode, setOrgMode] = useState<"existing" | "new">(
    organizations.length > 0 ? "existing" : "new",
  );
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setRole("customer");
    setOrgMode(organizations.length > 0 ? "existing" : "new");
    setPassword(generatePassword());
    setFormError(null);
    setFieldIssues({});
    setCreated(null);
    setCopied(false);
    setSubmitting(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setSubmitting(true);
    setFormError(null);
    setFieldIssues({});

    const selectedRole = String(formData.get("role") ?? "customer") as UserRole;
    const organizationId = String(formData.get("organizationId") ?? "");
    const organizationName = String(formData.get("organizationName") ?? "");

    const payload: Record<string, unknown> = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      role: selectedRole,
    };

    if (selectedRole === "customer") {
      if (orgMode === "existing" && organizationId) {
        payload.organizationId = organizationId;
      } else if (organizationName) {
        payload.organizationName = organizationName;
      }
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const record = (data ?? {}) as {
          error?: string;
          fields?: Record<string, string>;
        };
        setFormError(record.error ?? "Could not create the account.");
        setFieldIssues(record.fields ?? {});
        return;
      }

      setCreated({
        email: String(payload.email),
        password: String(payload.password),
        role: selectedRole,
        organizationName:
          selectedRole === "admin"
            ? null
            : orgMode === "existing"
              ? (organizations.find((o) => o.id === organizationId)?.name ?? null)
              : organizationName,
      });

      // Refresh the server component list behind the dialog.
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" />
        New user
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={created ? "Account created" : "New user"}
        description={
          created
            ? "Share these credentials with the user. The password is shown only once."
            : "Create a platform admin, or a customer user attached to one organization."
        }
      >
        {created ? (
          <div className="space-y-4">
            <dl className="divide-y divide-slate-100 rounded-lg bg-slate-50 px-4 py-2 text-sm ring-1 ring-slate-200">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{created.email}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-slate-500">Password</dt>
                <dd className="font-mono text-slate-900">{created.password}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium capitalize text-slate-900">
                  {created.role}
                </dd>
              </div>
              {created.organizationName ? (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-slate-500">Organization</dt>
                  <dd className="font-medium text-slate-900">
                    {created.organizationName}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${created.email} / ${created.password}`,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied" : "Copy credentials"}
              </Button>
              <Button
                onClick={() => {
                  reset();
                }}
              >
                Create another
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormError message={formError} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                htmlFor="user-fullName"
                required
                error={fieldIssues.fullName}
              >
                <TextInput
                  id="user-fullName"
                  name="fullName"
                  required
                  maxLength={120}
                  placeholder="Anna Andersson"
                  invalid={Boolean(fieldIssues.fullName)}
                />
              </Field>

              <Field label="Role" htmlFor="user-role" required error={fieldIssues.role}>
                <SelectInput
                  id="user-role"
                  name="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Platform admin</option>
                </SelectInput>
              </Field>
            </div>

            <Field label="Email" htmlFor="user-email" required error={fieldIssues.email}>
              <TextInput
                id="user-email"
                name="email"
                type="email"
                required
                placeholder="anna@example.com"
                invalid={Boolean(fieldIssues.email)}
              />
            </Field>

            <Field
              label="Temporary password"
              htmlFor="user-password"
              required
              error={fieldIssues.password}
              hint="At least 10 characters, with a letter and a number."
            >
              <div className="flex gap-2">
                <TextInput
                  id="user-password"
                  name="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  invalid={Boolean(fieldIssues.password)}
                  className="font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={() => setPassword(generatePassword())}
                  className="shrink-0"
                >
                  Generate
                </Button>
              </div>
            </Field>

            {role === "customer" ? (
              <div className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium text-slate-700">
                    Organization
                  </legend>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="orgMode"
                        checked={orgMode === "existing"}
                        disabled={organizations.length === 0}
                        onChange={() => setOrgMode("existing")}
                        className="size-3.5"
                      />
                      Existing
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="orgMode"
                        checked={orgMode === "new"}
                        onChange={() => setOrgMode("new")}
                        className="size-3.5"
                      />
                      Create new
                    </label>
                  </div>
                </fieldset>

                {orgMode === "existing" ? (
                  <Field
                    label="Select organization"
                    htmlFor="user-organizationId"
                    required
                    error={fieldIssues.organizationId}
                  >
                    <SelectInput
                      id="user-organizationId"
                      name="organizationId"
                      required
                      defaultValue={organizations[0]?.id ?? ""}
                    >
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                ) : (
                  <Field
                    label="New organization name"
                    htmlFor="user-organizationName"
                    required
                    error={fieldIssues.organizationName}
                  >
                    <TextInput
                      id="user-organizationName"
                      name="organizationName"
                      required
                      maxLength={160}
                      placeholder="e.g. Northstar Consulting AB"
                      invalid={Boolean(fieldIssues.organizationName)}
                    />
                  </Field>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 ring-1 ring-indigo-200">
                Platform admins are global: they are not attached to an
                organization and can operate on behalf of any customer.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? (
                  <>
                    <Spinner />
                    Creating...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

/**
 * Readable but high-entropy temporary password (~62 bits), generated in the
 * browser with the Web Crypto API so it never travels anywhere it is not
 * needed. The admin passes it to the user and they can change it later.
 */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(
    "",
  );
  // Guarantees the "contains a digit" rule even if the random draw misses one.
  return `${body}7`;
}
