export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  papel: "gestor" | "motorista";
  unidade_id: string | null;
  telefone: string | null;
  ativo: boolean;
  is_gestor_principal: boolean;
  primeira_senha: boolean;
  foto_url: string | null;
  ultimo_login: string | null;
}

export type PhotoSource = "camera" | "gallery";

export interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface AlertDialogState {
  visible: boolean;
  title: string;
  message: string;
  type: "default" | "error" | "success" | "warning";
}
