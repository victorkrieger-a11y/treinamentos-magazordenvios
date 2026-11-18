"use client";

import { Ban, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/confirm-action";
import { cancelAssignment, cancelQuiz } from "@/server/actions/quizzes";

export function CancelQuizButton({ quizId }: { quizId: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="destructive" size="sm"><Ban /> Cancelar avaliação</Button>}
      title="Cancelar esta avaliação?"
      description="As atribuições ainda não concluídas serão canceladas e deixarão de contar nos indicadores. Resultados já concluídos são preservados."
      confirmLabel="Cancelar avaliação"
      action={() => cancelQuiz(quizId)}
    />
  );
}

export function CancelAssignmentButton({ assignmentId, name }: { assignmentId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="xs" aria-label={`Cancelar avaliação de ${name}`}><XCircle /> Cancelar</Button>}
      title={`Cancelar a avaliação de ${name}?`}
      description="Uma tentativa em andamento será descartada e o colaborador será notificado."
      confirmLabel="Cancelar atribuição"
      action={() => cancelAssignment(assignmentId)}
    />
  );
}
