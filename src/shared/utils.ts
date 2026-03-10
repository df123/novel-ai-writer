export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(timestamp: number): string {
  const isSeconds = timestamp < 10000000000;
  const milliseconds = isSeconds ? timestamp * 1000 : timestamp;
  return new Date(milliseconds).toLocaleString('zh-CN');
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  let tokens = 0;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      tokens += 1.3;
    } else if (charCode >= 0x3000 && charCode <= 0x303f) {
      tokens += 1;
    } else if (charCode >= 0xff00 && charCode <= 0xffef) {
      tokens += 1.2;
    } else if (charCode >= 0x20 && charCode <= 0x7e) {
      tokens += 0.25;
    } else {
      tokens += 0.5;
    }
  }
  
  return Math.ceil(tokens);
}

export function estimateMessageTokens(message: { role?: string; content?: string }): number {
  let tokens = 4;
  
  if (message.role) {
    tokens += estimateTokens(message.role);
  }
  
  if (message.content) {
    tokens += estimateTokens(message.content);
  }
  
  return tokens;
}

export function estimateConversationTokens(messages: { role?: string; content?: string }[]): number {
  let totalTokens = 3;
  
  for (const message of messages) {
    totalTokens += estimateMessageTokens(message);
  }
  
  return Math.ceil(totalTokens);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
