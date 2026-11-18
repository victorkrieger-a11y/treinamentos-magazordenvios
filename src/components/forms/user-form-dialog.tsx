"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { createUserSchema, type CreateUserInput } from "@/lib/validation/users";
import { createUser } from "@/server/actions/users";

const NONE = "__none__";

export function UserFormDialog({
  role,
  guardians = [],
  triggerLabel,
}: {
  role: "collaborator" | "guardian" | "supervisor";
  guardians?: { id: string; fullName: string }[];
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: "", email: "", role, guardianId: null, jobTitle: "", startedAt: "" },
  });
  const { errors } = form.formState;
  const title = role === "collaborator" ? "Cadastrar colaborador" : role === "guardian" ? "Cadastrar guardião" : "Cadastrar supervisor";

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    start(async () => {
      const res = await createUser(values);
      if (!res.ok) {
        setServerError(res.error);
        for (const [k, v] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof CreateUserInput, { message: v?.[0] });
        return;
      }
      toast.success(res.message ?? "Usuário cadastrado.");
      form.reset();
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setServerError(null); }}>
      <DialogTrigger asChild>
        <Button><UserPlus /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Um convite será enviado por e-mail para que a pessoa defina a própria senha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {serverError && <p role="alert" className="rounded-lg bg-mz-red-soft px-3 py-2 text-sm text-mz-red-strong">{serverError}</p>}
          <Field id="fullName" label="Nome completo" required error={errors.fullName?.message}>
            <Input id="fullName" {...form.register("fullName")} aria-invalid={!!errors.fullName} />
          </Field>
          <Field id="email" label="E-mail corporativo" required error={errors.email?.message}>
            <Input id="email" type="email" {...form.register("email")} aria-invalid={!!errors.email} />
          </Field>
          {role === "collaborator" && (
            <Field id="guardianId" label="Guardião responsável" error={errors.guardianId?.message}>
              <Controller
                control={form.control}
                name="guardianId"
                render={({ field }) => (
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <SelectTrigger id="guardianId" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem guardião por enquanto</SelectItem>
                      {guardians.map((g) => <SelectItem key={g.id} value={g.id}>{g.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="jobTitle" label="Cargo ou função" error={errors.jobTitle?.message}>
              <Input id="jobTitle" {...form.register("jobTitle")} placeholder={role === "collaborator" ? "Ex.: Analista de suporte" : undefined} />
            </Field>
            <Field id="startedAt" label="Data de entrada na operação" error={errors.startedAt?.message}>
              <Input id="startedAt" type="date" {...form.register("startedAt")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enviar convite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
