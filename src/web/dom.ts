// A tiny helper for building page elements without a framework.

type Child = Node | string | number | null | false | undefined;

/**
 * h('button', { class: 'btn', onclick: go }, 'Play')
 * Attributes starting with "on" become event listeners; false/null ones are skipped.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Builds an element from an SVG string. */
export function svg(markup: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstChild as SVGElement;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
