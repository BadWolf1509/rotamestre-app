import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal/LegalPage';

export default function PoliticaDePrivacidade() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="24 de julho de 2026">
      <LegalSection title="1. Quem somos">
        <LegalParagraph>
          O Rota Mestre é uma plataforma de gestão logística utilizada por
          empresas, gestores e motoristas para planejar, executar e acompanhar
          rotas de entrega. Esta política descreve o tratamento de dados no
          aplicativo Android e na plataforma web.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Dados tratados">
        <LegalBullet>
          Dados de conta e perfil: nome, e-mail, telefone, identificador,
          empresa, unidade e função.
        </LegalBullet>
        <LegalBullet>
          Dados operacionais: rotas, paradas, endereços, destinatários,
          telefones, observações, ocorrências e registros de auditoria.
        </LegalBullet>
        <LegalBullet>
          Localização aproximada e precisa do motorista durante uma rota ativa,
          inclusive quando o aplicativo está fechado ou não está em uso.
        </LegalBullet>
        <LegalBullet>
          Fotos de perfil, comprovantes de entrega e incidentes enviadas pelo
          usuário.
        </LegalBullet>
        <LegalBullet>
          Dados técnicos: endereço IP, informações básicas do dispositivo,
          registros de falha, atividade no aplicativo e token de notificação.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="3. Finalidades">
        <LegalBullet>Autenticar e administrar contas e permissões.</LegalBullet>
        <LegalBullet>
          Planejar rotas, orientar motoristas e comprovar entregas.
        </LegalBullet>
        <LegalBullet>
          Permitir ao gestor acompanhar uma rota ativa em tempo real.
        </LegalBullet>
        <LegalBullet>
          Enviar notificações operacionais, produzir relatórios e manter a
          segurança e a auditoria do serviço.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="4. Localização em segundo plano">
        <LegalParagraph>
          A localização em segundo plano é utilizada somente por usuários
          motoristas durante uma rota ativa. Ela é enviada aos sistemas do Rota
          Mestre para navegação, registro do progresso e acompanhamento pelo
          gestor da empresa. O rastreamento é interrompido quando a rota é
          encerrada ou pausada. A permissão pode ser negada ou revogada nas
          configurações do Android, com limitação do acompanhamento contínuo.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Prestadores de serviço">
        <LegalParagraph>
          Utilizamos prestadores que processam dados sob nossas instruções,
          incluindo Supabase para autenticação, banco de dados e arquivos;
          Google para mapas, rotas e notificações; Expo para infraestrutura do
          aplicativo e notificações; e serviços de monitoramento de falhas. Não
          vendemos dados pessoais e não os utilizamos para publicidade
          comportamental.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Segurança">
        <LegalParagraph>
          Aplicamos conexão criptografada em trânsito, controle de acesso por
          usuário e empresa, armazenamento protegido da sessão no dispositivo,
          arquivos privados e registros de auditoria. Nenhum sistema é
          totalmente imune a riscos; incidentes relevantes serão tratados
          conforme a legislação aplicável.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Retenção">
        <LegalBullet>
          Conta e perfil: enquanto a conta estiver ativa e até 30 dias após uma
          solicitação que exija análise manual.
        </LegalBullet>
        <LegalBullet>
          Localizações detalhadas: pelo período necessário à execução, segurança
          e auditoria operacional, normalmente até 180 dias.
        </LegalBullet>
        <LegalBullet>
          Rotas, entregas, ocorrências e comprovantes empresariais: conforme o
          contrato da empresa e obrigações legais, com anonimização da conta
          excluída quando a manutenção do registro for necessária.
        </LegalBullet>
        <LegalBullet>
          Registros técnicos e de segurança: normalmente até 12 meses.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="8. Direitos e exclusão">
        <LegalParagraph>
          O titular pode solicitar acesso, correção, portabilidade, oposição ou
          exclusão. A conta pode ser excluída dentro do perfil do aplicativo ou
          pela página pública rotamestre.tec.br/exclusao-de-conta. Após a
          exclusão, identificadores pessoais são removidos; registros
          empresariais ou legais estritamente necessários podem ser preservados
          de forma anonimizada ou com acesso restrito.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Dados de terceiros">
        <LegalParagraph>
          Empresas usuárias devem possuir base legal para cadastrar endereços,
          nomes e telefones de destinatários. Esses dados são usados somente
          para executar a entrega e atender às obrigações relacionadas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Alterações">
        <LegalParagraph>
          Alterações relevantes serão comunicadas no aplicativo ou nos canais
          cadastrados. A versão e a data mais recentes permanecem disponíveis
          nesta página.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
