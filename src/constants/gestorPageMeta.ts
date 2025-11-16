import type { BreadcrumbItem } from '@/components/desktop/DesktopPageLayout';

export type GestorPageKey =
  | 'inicio'
  | 'novaRota'
  | 'historico'
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
  historico: {
    title: 'Histórico de Rotas',
    subtitle: 'Acompanhe rotas passadas e exporte relatórios',
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Histórico' },
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
      { label: 'Histórico', route: '/gestor/historico' },
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
    icon: 'warning-outline' as any,
    breadcrumbs: [
      { label: 'Início', route: '/gestor/inicio' },
      { label: 'Incidentes' },
    ],
  },
};

export const getGestorPageMeta = (key: GestorPageKey): PageMeta =>
  gestorPageMeta[key];
