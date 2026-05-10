/**
 * aiParser.js — 大模型任务解析服务
 *
 * 支持多个国内大模型 API，统一为 OpenAI 兼容格式调用。
 * 用户可在设置中选择服务商并配置 API Key。
 *
 * localStorage 键:
 *   mytask_ai_provider  — 当前选择的服务商标识
 *   mytask_ai_key       — API Key
 *
 * 返回格式:
 *   { title, recognizedDate, recognizedTime, priority, tags, notes, rawJson }
 */

/* ================================================================== */
/*  服务商注册表                                                       */
/* ================================================================== */

/**
 * 每个服务商配置:
 *   id           — 唯一标识
 *   name         — 显示名称
 *   baseUrl      — API 端点 (会自动拼接 /chat/completions)
 *   model        — 默认模型
 *   authHeader   — 鉴权方式: 'bearer' → Authorization: Bearer <key>
 *                              'custom' → 自定义 header
 *   customAuthHeader — 当 authHeader='custom' 时的 header 名
 *   description  — 简短描述，显示在 UI 中
 */
const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    authHeader: 'bearer',
    description: '价格最低，1元/百万token，质量好',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    authHeader: 'bearer',
    description: '有免费额度，中文理解优秀',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    authHeader: 'bearer',
    description: '长文本处理出色，OpenAI 兼容',
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
    authHeader: 'bearer',
    description: '阿里系，有免费额度',
  },
  {
    id: 'doubao',
    name: '豆包 (火山引擎)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-lite-128k',
    authHeader: 'bearer',
    description: '字节系，128K 上下文',
  },
];

/* ================================================================== */
/*  System Prompt（所有服务商通用）                                    */
/* ================================================================== */

function buildSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `你是一个任务解析助手。从用户输入的文本中提取所有待办任务。输入可能是单句话，也可能是聊天对话记录。

规则:
1. 从文本中找出所有需要执行的任务，每个任务包含以下字段:
   - title: 提炼核心任务描述，去除日期/时间等修饰语，保留关键动作和对象
   - person: 任务的执行者或负责人。如果是聊天对话（如"张三：..."），提取说话对象的名字（只取人名，不含冒号和称呼）；如果不是对话格式，设为 null
   - dueDate: 识别日期并转为 YYYY-MM-DD 格式（以当前日期 ${today} 为基准推算）。支持: 今天/明天/后天/下周X/本周X/X月X日/日期数字 等。无法识别则为 null
   - dueTime: 识别时间并转为 HH:MM 格式（24小时制）。支持: 下午3点/3:00/三点半 等。无法识别则为 null
   - priority: 根据紧迫度或关键词判断，high/medium/low，默认 medium
   - tags: 提取 0-3 个分类标签，如 ["会议","个人","工作"]
   - notes: 补充说明或备注，没有则为 null

2. 如果是聊天对话（多个人名+冒号的格式），从对话中提取每个人的承诺和待办事项，每个承诺一个任务
3. 如果文本只有一个任务，tasks 数组也只有一项

只返回 JSON，不要其他文字:
{"tasks":[{"person":"张三","title":"...","dueDate":"YYYY-MM-DD|null","dueTime":"HH:MM|null","priority":"high|medium|low","tags":["..."],"notes":"..."}]}`;
}

/* ================================================================== */
/*  配置存取                                                           */
/* ================================================================== */

/** 所有可用服务商列表 */
export function getProviders() {
  return PROVIDERS;
}

/** 获取当前选中的服务商配置 */
export function getSelectedProvider() {
  const savedId = localStorage.getItem('mytask_ai_provider') || 'deepseek';
  return PROVIDERS.find((p) => p.id === savedId) || PROVIDERS[0];
}

/** 保存用户选择的服务商 */
export function saveProvider(providerId) {
  localStorage.setItem('mytask_ai_provider', providerId);
}

/**
 * 读取所有服务商的 Key 映射表
 * @returns {object} { "deepseek": "sk-xxx", "zhipu": null, ... }
 */
export function getAllKeys() {
  try {
    const raw = localStorage.getItem('mytask_ai_keys');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * 获取指定服务商（或当前选中）的 API Key
 * @param {string} [providerId] 可选，默认当前选中
 * @returns {string|null}
 */
export function getApiKey(providerId) {
  const id = providerId || getSelectedProvider().id;
  const keys = getAllKeys();
  return keys[id] || null;
}

/**
 * 保存指定服务商的 API Key
 * @param {string} key - API Key
 * @param {string} [providerId] 可选，默认当前选中
 */
export function saveApiKey(key, providerId) {
  const id = providerId || getSelectedProvider().id;
  const keys = getAllKeys();
  keys[id] = key.trim();
  localStorage.setItem('mytask_ai_keys', JSON.stringify(keys));
}

/**
 * 删除指定服务商的 API Key
 * @param {string} [providerId] 可选，默认当前选中
 */
export function removeApiKey(providerId) {
  const id = providerId || getSelectedProvider().id;
  const keys = getAllKeys();
  delete keys[id];
  localStorage.setItem('mytask_ai_keys', JSON.stringify(keys));
}

/**
 * 检查指定服务商（或当前选中）是否已配置 Key
 * @param {string} [providerId] 可选，默认当前选中
 * @returns {boolean}
 */
export function hasApiKey(providerId) {
  const key = getApiKey(providerId);
  return !!key && key.length > 0;
}

/* ================================================================== */
/*  API 调用                                                           */
/* ================================================================== */

/**
 * 构建请求 headers（处理不同鉴权方式）
 */
function buildHeaders(provider, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (provider.authHeader === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider.authHeader === 'custom' && provider.customAuthHeader) {
    headers[provider.customAuthHeader] = apiKey;
  }

  return headers;
}

/**
 * 调用大模型 API 解析任务文本
 * @param {string} text - 用户输入的原始文本
 * @returns {Promise<object>} 结构化解析结果
 */
export async function aiParse(text) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const provider = getSelectedProvider();
  const url = `${provider.baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(provider, apiKey),
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));

    // 不同服务商的错误消息字段不同
    const msg = errBody.error?.message
      || errBody.msg
      || errBody.message
      || `HTTP ${response.status}`;

    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }

    throw new Error(msg);
  }

  const data = await response.json();

  // OpenAI 兼容格式: data.choices[0].message.content
  const rawText = data.choices?.[0]?.message?.content || '';

  // 提取 JSON（部分模型可能包裹在 ```json ... ``` 中）
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('PARSE_ERROR: 模型返回格式异常');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('PARSE_ERROR: JSON 解析失败');
  }

  // 统一为 tasks 数组格式（兼容旧版单任务格式）
  let tasks = [];
  if (parsed.tasks && Array.isArray(parsed.tasks)) {
    tasks = parsed.tasks;
  } else if (parsed.title) {
    // 旧格式：单任务对象
    tasks = [parsed];
  }

  // 标准化每个任务
  const normalized = tasks.map((t) => ({
    title: t.title || text,
    person: t.person || null,
    recognizedDate: t.dueDate || null,
    recognizedTime: t.dueTime || null,
    priority: t.priority || 'medium',
    tags: t.tags || [],
    notes: t.notes || null,
  }));

  return {
    originalText: text,
    tasks: normalized,
    rawJson: parsed,
    providerName: provider.name,
    model: provider.model,
  };
}
