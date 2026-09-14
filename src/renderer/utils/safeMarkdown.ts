// 安全 Markdown 渲染（设计书 §23/§7 P0-4）：
// marked 输出必须经 DOMPurify 消毒后才能进 v-html，组件禁止直接 marked() → v-html
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true
});

/** 唯一允许的 Markdown → HTML 入口：LLM 输出/实体内容统一走这里 */
export function renderSafeMarkdown(markdown: string): string {
  if (!markdown) return '';
  try {
    const rawHtml = marked.parse(markdown, { async: false });
    return DOMPurify.sanitize(rawHtml);
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    // 渲染异常时退化为转义文本，绝不把原文当 HTML 放行
    return DOMPurify.sanitize(markdown);
  }
}
