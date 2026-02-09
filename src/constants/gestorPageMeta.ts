import type { BreadcrumbItem } from '@/design-system';

export type GestorPageKey =
  | 'inicio'
  | 'novaRota'
  | 'gestao-rotas'
  | 'motoristas'
  | 'mapaRota'
  | 'perfil'
  | 'minhaUnidade'
  | 'equipe'
  | 'transferirUnidade'
  | 'incidentes';

interface PageMeta {
  title: string;
  subtitle?: string;
  icon?: string;
  breadcrumbs: BreadcrumbItem[];
}

export const gestorPageMeta: Record<GestorPageKey, PageMeta> = {
  inicio: {
    title: 'Início',
    subtitle: 'Visão geral da sua operação',
    breadcrumbs: [{ label: 'Início' }],
  },
  novaRota: {
    title: 'Nova Rota de Entrega',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Nova Rota' },
    ],
  },
  'gestao-rotas': {
    title: 'Gestão de Rotas',
    subtitle: 'Gerencie todas as rotas da sua unidade',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Gestão de Rotas' },
    ],
  },
  motoristas: {
    title: 'Motoristas',
    subtitle: 'Gerencie seus condutores e permissões',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Motoristas' },
    ],
  },
  mapaRota: {
    title: 'Mapa da Rota',
    subtitle: 'Visualização geográfica e detalhes do trajeto',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Gestão de Rotas', route: '/gestor/gestao-rotas' },
      { label: 'Mapa da Rota' },
    ],
  },
  perfil: {
    title: 'Meu Perfil',
    subtitle: 'Atualize seus dados pessoais e de acesso',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Meu Perfil' },
    ],
  },
  minhaUnidade: {
    title: 'Minha Unidade',
    subtitle: 'Informações e configurações administrativas',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Minha Unidade' },
    ],
  },
  equipe: {
    title: 'Equipe',
    subtitle: 'Membros e acessos da sua unidade',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Equipe' },
    ],
  },
  transferirUnidade: {
    title: 'Transferir Unidade',
    subtitle: 'Gerencie a transferência da gestão principal',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Minha Unidade', route: '/unidade' },
      { label: 'Transferir Unidade' },
    ],
  },
  incidentes: {
    title: 'Incidentes Reportados',
    subtitle: 'Gerenciar problemas e ocorrências das rotas',
    icon: 'warning-outline',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Incidentes' },
    ],
  },
};

export const getGestorPageMeta = (key: GestorPageKey): PageMeta =>
  gestorPageMeta[key];
