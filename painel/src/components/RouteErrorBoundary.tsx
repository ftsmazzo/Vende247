import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/** Impede tela preta: mostra o erro em vez de desmontar a árvore inteira. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label || "route"}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card space-y-3">
          <h2 className="font-display text-xl font-semibold text-coral">
            Falha ao abrir {this.props.label || "esta página"}
          </h2>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{this.state.error.message}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
