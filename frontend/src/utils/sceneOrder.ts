import { Scene } from '../../../shared/types';

// Orders scenes by the position their script_line appears in the script text.
// When multiple scenes share the same script_line, the scene created earlier
// binds to the earlier occurrence. Scenes whose text is absent from the script
// fall to the end.
export function sortScenesByScriptPosition<T extends Pick<Scene, 'id' | 'script_line' | 'created_at'>>(
  scenes: T[],
  scriptContent: string,
): T[] {
  if (!scriptContent) return scenes;

  const byText = new Map<string, T[]>();
  for (const scene of scenes) {
    const key = scene.script_line || '';
    const group = byText.get(key);
    if (group) group.push(scene);
    else byText.set(key, [scene]);
  }

  const posById = new Map<number, number>();
  for (const [text, group] of byText) {
    group.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!text) {
      for (const scene of group) posById.set(scene.id, -1);
      continue;
    }
    const occurrences: number[] = [];
    let from = 0;
    while (from <= scriptContent.length) {
      const idx = scriptContent.indexOf(text, from);
      if (idx === -1) break;
      occurrences.push(idx);
      from = idx + 1;
    }
    for (let i = 0; i < group.length; i++) {
      posById.set(group[i].id, occurrences[i] ?? -1);
    }
  }

  return [...scenes].sort((a, b) => {
    const aPos = posById.get(a.id) ?? -1;
    const bPos = posById.get(b.id) ?? -1;
    if (aPos === -1 && bPos === -1) return 0;
    if (aPos === -1) return 1;
    if (bPos === -1) return -1;
    return aPos - bPos;
  });
}
