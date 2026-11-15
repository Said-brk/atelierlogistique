import { optimize } from '../engine/optimizer';
import type { ContainerDefinition, ItemDefinition, OptimizeOptions } from '../engine/types';

interface RequestMessage {
  container: ContainerDefinition;
  definitions: ItemDefinition[];
  options?: OptimizeOptions;
}

// Le moteur tourne hors du thread principal : l'UI ne se fige jamais (CDC §38).
self.onmessage = (e: MessageEvent<RequestMessage>) => {
  try {
    const { container, definitions, options } = e.data;
    const result = optimize(container, definitions, options);
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
