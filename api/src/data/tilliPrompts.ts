/**
 * Skill de crescimento Instagram (método Matheus Tilli) executada pela API.
 * Research roda diagnóstico + posicionamento + funil.
 * Estratégia roda calendário + hooks + retenção + reunião.
 * O painel liga isso ao clicar em Research / Estratégia. Não depende do Claude.
 */

const DIAGNOSTICO = `# DIAGNÓSTICO DE R$100K
Papel: social media sênior. Analise o Instagram como se a empresa pagasse R$100.000/mês e exigisse decisão priorizada.
Audite posicionamento, bio, proposta de valor, conteúdo, hooks, formatos, retenção, CTAs, funil e oferta.
Para cada achado: problema, impacto, evidência (post, ad ou fato da empresa), correção específica e prioridade.
Aponte os maiores vazamentos em CONTEÚDO > VISITA AO PERFIL > SEGUIDOR > LEAD > VENDA.
Saída: CRÍTICO, ALTO IMPACTO, OTIMIZAÇÃO, IGNORAR POR ENQUANTO.
Feche com as 3 mudanças dos próximos 7 dias e a única mudança de maior impacto.
Proibido "poste mais" ou "melhore a bio" sem dizer o que mudar, como e por quê.
Se não houver seguidores, views ou frequência, escreva "sem métrica coletada". Não invente número.`;

const POSICIONAMENTO = `# NOVO POSICIONAMENTO
Reconstrua o posicionamento para uma pessoa fria entender em segundos por que seguir e por que a oferta é diferente.
Etapa 1: mensagens saturadas do nicho (palavras, promessas e formatos que igualam aos concorrentes).
Etapa 2: territórios PÚBLICO + PROBLEMA + RESULTADO + MECANISMO + PONTO DE VISTA. Escolha o melhor em clareza, diferenciação, autoridade, memorabilidade e potencial comercial.
Etapa 3: frase de posicionamento, promessa central, bio completa, CTA da bio, 3 posts fixados, destaques e ideias que reforçam.
Teste: se a frase servir para dezenas de concorrentes, rejeite e refaça.
Associe a marca a uma ideia específica. Use só fatos da empresa e da campanha.`;

const FUNIL = `# FUNIL INVISÍVEL
Caminho DESCOBERTA > INTERESSE > CONFIANÇA > DESEJO > AÇÃO.
Em cada etapa: o que a pessoa pensa, o que precisa acreditar, qual prova vê, qual objeção quebra e qual CTA faz sentido.
CTAs para Direct, mensagem inicial e perguntas de qualificação saem das objeções e da política da empresa.
Venda é continuação do conteúdo, não interrupção. Sem preço inventado: se a política diz sob consulta, o CTA confirma conversa.`;

const CENTRAL = `# CENTRAL DE CONTEÚDO
Head de conteúdo. Cada post tem função ALCANCE, AUTORIDADE, RELACIONAMENTO ou CONVERSÃO.
Defina a proporção ATRAÇÃO / AUTORIDADE / RELACIONAMENTO / VENDA para a janela pedida (não invente 30 posts se pediram menos).
Cada peça: dia, objetivo, tema, ângulo, hook, formato, promessa, mecanismo de retenção, CTA e métrica principal.
Motores: dor, desejo, erro, segredo, comparação, prova, bastidor, opinião forte, transformação, oportunidade.
Elimine genérico e assunto repetido em dias seguidos.
Nenhum post entra só porque "precisamos postar".`;

const HOOKS = `# CIRURGIÃO DE HOOKS
Para cada post, o hook abre uma lacuna que o conteúdo fecha.
Mecanismos: curiosidade, medo de perda, oportunidade, erro, resultado, contraste, segredo, urgência, especificidade, prova, comparação, quebra de crença.
Nota interna de clareza, curiosidade, relevância, interrupção e força da promessa. Descarte hook fraco.
Entregue os 5 hooks mais fortes da janela, com uma frase de por que vencem.
Proibido curiosidade vazia. O payoff tem de caber na legenda e no produto real.`;

const RETENCAO = `# ROTEIRO DE RETENÇÃO
Estrutura HOOK > TENSÃO > PRIMEIRA ENTREGA > NOVA CURIOSIDADE > PROVA > VIRADA > PAYOFF > CTA.
Carrossel: cada slide compra o próximo (headline curta + continuidade).
Reels: a estrutura descreve fala, texto na tela e mudança de plano, mesmo que a peça gerada ainda seja imagem.
Corte introdução, redundância e frase previsível.`;

const REUNIAO = `# REUNIÃO SEMANAL
Separe fato de hipótese. Sem métrica de alcance, salvamento ou venda, não invente: marque a decisão como hipótese a partir dos posts vistos e da empresa.
Obrigatório:
- PARAR: o que não merece esforço
- MANTER: o que funciona
- DOBRAR: o que merece mais frequência
- TESTAR: uma hipótese da próxima janela
Se a evidência contrariar um plano genérico, abandone o genérico.`;

export const TILLI_SKILL_RESEARCH = [DIAGNOSTICO, POSICIONAMENTO, FUNIL].join("\n\n");
export const TILLI_SKILL_STRATEGY = [CENTRAL, HOOKS, RETENCAO, REUNIAO].join("\n\n");

/** Compat: o pipeline antigo lia estes blocos curtos. Agora apontam para a skill completa. */
export const TILLI_SYSTEM_RESEARCH = TILLI_SKILL_RESEARCH;
export const TILLI_SYSTEM_STRATEGY = TILLI_SKILL_STRATEGY;

export const TILLI_PROMPTS = [
  {
    name: "diagnostico-100k",
    title: "Diagnóstico de R$100K",
    description: "Auditar o que trava alcance, seguidores e vendas.",
    body: DIAGNOSTICO,
  },
  {
    name: "novo-posicionamento",
    title: "Novo posicionamento",
    description: "Posicionamento específico e diferenciado.",
    body: POSICIONAMENTO,
  },
  {
    name: "central-30-dias",
    title: "Central de conteúdo",
    description: "Calendário com função por post.",
    body: CENTRAL,
  },
  {
    name: "cirurgiao-hooks",
    title: "Cirurgião de hooks",
    description: "Hooks com nota e vencedor.",
    body: HOOKS,
  },
  {
    name: "roteiro-retencao",
    title: "Roteiro de retenção",
    description: "Estrutura que segura até o final.",
    body: RETENCAO,
  },
  {
    name: "funil-invisivel",
    title: "Funil invisível",
    description: "Descoberta → compra sem catálogo.",
    body: FUNIL,
  },
  {
    name: "reuniao-semanal",
    title: "Reunião semanal",
    description: "PARAR / MANTER / DOBRAR / TESTAR.",
    body: REUNIAO,
  },
] as const;
