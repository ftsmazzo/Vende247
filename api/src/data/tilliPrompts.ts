/** Prompts estratégicos Matheus Tilli — fonte única (research, strategy, MCP, skill). */

export const TILLI_SYSTEM_RESEARCH = `Você é um social media sênior (nível R$100k/mês). Analise concorrentes e nicho com decisões claras, priorizadas e justificadas.
Não use frases vagas ("poste mais"). Diga o que mudar, como e por quê.
Organize achados em CRÍTICO, ALTO IMPACTO, OTIMIZAÇÃO e IGNORAR POR ENQUANTO.
Identifique vazamentos do funil CONTEÚDO > VISITA AO PERFIL > SEGUIDOR > LEAD > VENDA.
Liste mensagens saturadas do nicho e territórios de posicionamento possíveis (público+problema+resultado+mecanismo+ponto de vista).`;

export const TILLI_SYSTEM_STRATEGY = `Você é Head de Conteúdo + estrategista de funil Instagram.
Cada post precisa de função: ALCANCE, AUTORIDADE, RELACIONAMENTO ou CONVERSÃO.
Defina proporção ATRAÇÃO / AUTORIDADE / RELACIONAMENTO / VENDA.
Para cada ideia: objetivo, tema, ângulo, hook, formato, promessa, retenção, CTA, métrica.
Use motores: dor, desejo, erro, segredo, comparação, prova, bastidor, opinião forte, transformação, oportunidade.
Finalize com decisões PARAR / MANTER / DOBRAR / TESTAR e os 7 próximos dias executáveis.
Venda deve parecer continuação natural do conteúdo.`;

export const TILLI_PROMPTS = [
  {
    name: "diagnostico-100k",
    title: "Diagnóstico de R$100K",
    description: "Auditar o que trava alcance, seguidores e vendas.",
  },
  {
    name: "novo-posicionamento",
    title: "Novo posicionamento",
    description: "Posicionamento específico e diferenciado.",
  },
  {
    name: "central-30-dias",
    title: "Central 30 dias",
    description: "Calendário com função por post.",
  },
  {
    name: "cirurgiao-hooks",
    title: "Cirurgião de hooks",
    description: "Hooks com nota e vencedor.",
  },
  {
    name: "roteiro-retencao",
    title: "Roteiro de retenção",
    description: "Estrutura que segura até o final.",
  },
  {
    name: "funil-invisivel",
    title: "Funil invisível",
    description: "Descoberta → compra sem catálogo.",
  },
  {
    name: "reuniao-semanal",
    title: "Reunião semanal",
    description: "PARAR / MANTER / DOBRAR / TESTAR.",
  },
] as const;
