export type Position = {
  index: number;
  line: number;
  column: number;
};

export type IgnoredRange = {
  start: number;
  end: number;
  reason: "code_block" | "inline_code" | "url" | "frontmatter";
};

export type LintIssue = {
  ruleId: string;
  severity: "info" | "warning" | "error";
  message: string;
  text: string;
  index: number;
  line: number;
  column: number;
  context?: string;
  suggestion?: string | null;
};

export type CheckResult = {
  ok: boolean;
  summary: {
    issueCount: number;
    rules: Record<string, number>;
  };
  issues: LintIssue[];
};

export type CheckOptions = {
  format?: "text" | "markdown";
  rules?: string[];
  allowKanji?: string[];
  allowWords?: string[];
  ignore?: {
    codeBlock?: boolean;
    inlineCode?: boolean;
    url?: boolean;
    frontmatter?: boolean;
  };
};
