"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { updateUserSchema, type UpdateUserInput } from "@/lib/validation/users";
import { resendAccess, updateUser } from "@/server/actions/users";

export function EditUserDialog({ user }: { user: { id: string; fullName: string; email: string; jobTitle: string | null; startedAt: string | null; status: "invited" | "active" | "inactive" } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { id: user.id, fullName: user.fullName, jobTitle: user.jobTitle ?? "", startedAt: user.startedAt ?? "", status: user.status },
  });
  const { errors } = form.formState;
  const status = form.watch("status");

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const res = await updateUser(values);
      if (!res.ok) return setError(res.error);
      toast.success(res.message ?? "Atualizado.");
      setOpen(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil /> Editar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {error && <p role="alert" className="rounded-lg bg-mz-red-soft px-3 py-2 text-sm text-mz-red-strong">{error}</p>}
          <Field id="edit-name" label="Nome completo" required error={errors.fullName?.message}>
            <Input id="edit-name" {...form.register("fullName")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="edit-job" label="Cargo ou função" error={errors.jobTitle?.message}>
              <Input id="edit-job" {...form.register("jobTitle")} />
            </Field>
            <Field id="edit-start" label="Data de entrada" error={errors.startedAt?.message}>
              <Input id="edit-start" type="date" {...form.register("startedAt")} />
            </Field>
          </div>
          <Field id="edit-status" label="Status" hint={status === "inactive" ? "Usuários inativos perdem o acesso. O histórico de avaliações é preservado." : user.status === "invited" ? "A conta fica ativa automaticamente no primeiro acesso." : undefined}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {user.status === "invited" && <SelectItem value="invited">Convidado (aguardando primeiro acesso)</SelectItem>}
                    {user.status !== "invited" && <SelectItem value="active">Ativo</SelectItem>}
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <DialogFooter className="sm:justify-between">
            {user.status === "invited" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await resendAccess(user.id);
                  if (res.ok) toast.success(res.message ?? "Enviado.");
                  else toast.error(res.error);
                })}
              >
                <Mail /> Reenviar acesso
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
