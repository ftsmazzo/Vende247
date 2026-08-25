const TYPES = [
  { id: "produto", label: "Produto" },
  { id: "servico", label: "Serviço" },
  { id: "candidato", label: "Candidato" },
  { id: "oferta", label: "Oferta" },
] as const;

export function CampaignTypePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={value === t.id ? "type-chip type-chip-on" : "type-chip"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const NICHO_HINT =
  "Quem compra e em que mercado. A pesquisa usa isso para achar concorrentes e ganchos — não é o nome da marca. Ex.: EPI para construtoras no interior; nutrição para mulheres 30+; deputado estadual no RJ.";
