import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal/LegalPage';

export default function TermosDeUso() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="24 de julho de 2026">
      <LegalSection title="1. Aceitação">
        <LegalParagraph>
          Estes termos regulam o uso do Rota Mestre por empresas, gestores e
          motoristas. Ao criar ou utilizar uma conta, o usuário declara ter
          capacidade para aceitar estes termos e cumprir as regras da empresa à
          qual está vinculado.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Finalidade do serviço">
        <LegalParagraph>
          O Rota Mestre oferece planejamento e acompanhamento de rotas,
          navegação, registro de entregas, ocorrências e relatórios
          operacionais. Estimativas de distância e tempo podem variar em razão
          de trânsito, sinal, dados cartográficos e condições externas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Conta e responsabilidades">
        <LegalBullet>
          Manter credenciais confidenciais e informações cadastrais corretas.
        </LegalBullet>
        <LegalBullet>
          Utilizar a plataforma somente para atividades legítimas e autorizadas.
        </LegalBullet>
        <LegalBullet>
          Obter autorização para cadastrar dados de funcionários, destinatários
          e entregas.
        </LegalBullet>
        <LegalBullet>
          Não tentar contornar controles de acesso, interferir no serviço ou
          acessar dados de outra empresa.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="4. Localização e segurança no trânsito">
        <LegalParagraph>
          O motorista escolhe iniciar a rota e o rastreamento relacionado. O uso
          do dispositivo deve respeitar as leis de trânsito e não substituir
          atenção, sinalização ou julgamento profissional. A localização em
          segundo plano pode ser desativada, mas isso limita o acompanhamento
          contínuo pela empresa.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Conteúdo enviado">
        <LegalParagraph>
          O usuário permanece responsável por fotos, observações e demais
          conteúdos enviados. A empresa declara possuir autorização para seu uso
          operacional. Conteúdo ilegal, ofensivo ou sem relação com a atividade
          poderá ser removido.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Disponibilidade">
        <LegalParagraph>
          Buscamos manter o serviço disponível e seguro, mas poderão ocorrer
          manutenções, falhas de conectividade ou indisponibilidade de
          prestadores. Recursos offline podem reduzir impactos, sem garantia de
          funcionamento contínuo em todas as condições.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Planos e pagamentos">
        <LegalParagraph>
          Quando houver contratação comercial, valores, período de avaliação,
          renovação e cancelamento serão apresentados no canal de contratação. O
          aplicativo Android não realiza cobrança pela Google Play nem promete
          período gratuito fora das condições formalmente oferecidas à empresa.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Encerramento e exclusão">
        <LegalParagraph>
          O usuário pode excluir sua conta no perfil do aplicativo ou solicitar
          a exclusão em rotamestre.tec.br/exclusao-de-conta. Dados pessoais são
          eliminados conforme a Política de Privacidade. Registros empresariais
          e legais necessários podem ser preservados de forma anonimizada ou
          restrita. A empresa poderá suspender contas em caso de uso indevido,
          risco de segurança ou término do contrato.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Propriedade intelectual">
        <LegalParagraph>
          Software, marcas, interfaces e materiais do Rota Mestre são protegidos
          pela legislação aplicável. O acesso concede apenas licença limitada,
          revogável e não transferível para uso do serviço.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Legislação aplicável">
        <LegalParagraph>
          Aplicam-se as leis brasileiras, incluindo a Lei Geral de Proteção de
          Dados. Eventuais controvérsias serão tratadas pelos canais de suporte
          e, quando necessário, pelo foro competente segundo a legislação.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
