const $ = (selector) => document.querySelector(selector);
const sourceText = $("#sourceText");
const outputText = $("#outputText");
const state = { analysis: null, selected: [], locked: [] };

const sample = `很多家长都是等孩子到了7岁，才真正意识到发育迟缓带来的影响。

因为孩子一上小学，考验的就不只是认字和算数了，还有注意力、理解力、逻辑能力和与人相处的能力。

有些发育迟缓的孩子虽然能正常入学，但学习明显比别人吃力，同样的内容需要反复教很多遍。还有些孩子因为认知和理解能力跟不上，很难适应正常的课堂。

这时候，家长经常会听到老师说：孩子坐不住、爱乱跑、不听指令，也不愿意跟同学一起玩。

其实孩子不一定是故意调皮，也不一定是不爱学习，而是他的语言、认知和注意力还没有跟上同龄孩子。

所以，对发育迟缓的孩子来说，能不能上学不是唯一的目标。更重要的是尽早发现问题，及时评估和干预，为以后的成长打好基础。`;

const roleMeta = {
  hook: ["主题钩子", "快速点题，吸引目标人群继续听"],
  context: ["原因解释", "说明问题为什么会在这个阶段显现"],
  situation: ["现实处境", "呈现具体困难和真实影响"],
  signs: ["表现列举", "用熟悉场景增强代入感"],
  correction: ["认知纠偏", "纠正常见误解，承接核心原因"],
  progression: ["风险递进", "说明问题随年龄或阶段的变化"],
  thesis: ["观点收束", "明确全文的核心判断"],
  action: ["行动建议", "给出自然、克制的下一步"],
};

const themes = [
  "语言发育迟缓", "智力发育迟缓", "发育迟缓", "孤独症", "自闭症",
  "注意缺陷", "多动症", "学习困难", "儿童康复", "早期干预",
];

const replacementSets = [
  [
    ["很多", "不少"], ["真正意识到", "真正发现"], ["因为", "这是因为"],
    ["不只是", "不光是"], ["还有", "也包括"], ["有些", "有的"],
    ["经常会", "常常会"], ["不一定", "未必"], ["更重要的是", "真正重要的是"],
    ["尽早", "早点"], ["及时", "尽快"],
  ],
  [
    ["很多", "许多"], ["才真正", "才开始"], ["进入", "到了"],
    ["很难", "往往难以"], ["明显", "比较"], ["其实", "但"],
    ["慢慢", "逐渐"], ["所以", "因此"], ["需要", "要"],
  ],
  [
    ["家长", "父母"], ["孩子", "小朋友"], ["同样", "一样"],
    ["反复", "一遍遍"], ["故意", "有意"], ["提高", "增加"],
    ["唯一", "单一"], ["以后", "后面"],
  ],
  [
    ["带来的影响", "造成的问题"], ["一上小学", "进入小学以后"],
    ["学习", "上课"], ["跟不上", "没有跟上"], ["打好基础", "做好准备"],
    ["不愿意", "不太愿意"], ["这时候", "到了这个阶段"],
  ],
];

function count(text) {
  return [...text].filter((char) => /[\u3400-\u9fffA-Za-z0-9%]/.test(char)).length;
}

function seconds(text) { return Math.round(count(text) / 4.55); }

function splitSentences(text) {
  return (text.replace(/\r/g, "").match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [])
    .map((item) => item.trim()).filter(Boolean);
}

function classify(sentence, index, total) {
  if (index === 0) return "hook";
  if (/尽早|及时|建议|评估|干预|应该|需要|下一步|打好基础/.test(sentence)) return "action";
  if (/所以|因此|关键|更重要|目标|真正需要关注|不能只/.test(sentence)) return "thesis";
  if (/尤其|随着|以后|年级|越来越|逐渐|慢慢暴露/.test(sentence)) return "progression";
  if (/其实|并不是|不一定|未必|并非|不是.*而是/.test(sentence)) return "correction";
  if (/表现|坐不住|乱跑|不听指令|不愿意|老师.*说|分心/.test(sentence)) return "signs";
  if (/有些|有的|吃力|跟不上|听不懂|记不住|难以适应|很难/.test(sentence)) return "situation";
  if (/因为|这是因为|进入|考验|要求|阶段/.test(sentence)) return "context";
  return index === total - 1 ? "thesis" : "situation";
}

function inferTheme(text) {
  return themes.find((theme) => text.includes(theme)) || "儿童成长与家庭教育";
}

function replaceWithSet(text, setIndex) {
  let result = text;
  replacementSets[setIndex].forEach(([from, to]) => { result = result.split(from).join(to); });
  return result;
}

function makeVariants(text) {
  const result = [text];
  replacementSets.forEach((_, index) => {
    const candidate = replaceWithSet(text, index);
    if (candidate !== text && !result.includes(candidate)) result.push(candidate);
  });
  const fallbacks = [
    text.replace(/^这时候，?/, "到了这个阶段，"),
    text.replace(/^其实，?/, "但实际上，"),
    text.replace(/^所以，?/, "因此，"),
    text.replace(/^因为，?/, "这是因为，"),
  ];
  fallbacks.forEach((candidate) => {
    if (candidate !== text && !result.includes(candidate)) result.push(candidate);
  });
  while (result.length < 4) result.push(text);
  return result.slice(0, 4);
}

function analyze(text) {
  const sentences = splitSentences(text);
  const raw = sentences.map((sentence, index) => ({
    role: classify(sentence, index, sentences.length),
    text: sentence,
  }));

  const grouped = [];
  raw.forEach((item) => {
    const previous = grouped[grouped.length - 1];
    if (previous && previous.role === item.role && previous.text.length + item.text.length < 150) {
      previous.text += item.text;
    } else {
      grouped.push({ ...item });
    }
  });

  const theme = inferTheme(text);
  return {
    theme,
    thesis: `围绕“${theme}”保持原意进行口语化模块改写`,
    lockedFacts: ["不新增诊断结论", "不新增疗效承诺", "保留原文核心主题"],
    modules: grouped.map((item, index) => ({
      id: `m${index + 1}`,
      role: item.role,
      label: roleMeta[item.role][0],
      purpose: roleMeta[item.role][1],
      original: item.text,
      targetChars: count(item.text),
      variants: makeVariants(item.text),
    })),
  };
}

function toast(message, error = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast ${error ? "error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 2600);
}

function updateMetrics() {
  const sourceCount = count(sourceText.value);
  const resultCount = count(outputText.value);
  $("#sourceCount").textContent = `${sourceCount} 字`;
  $("#sourceTime").textContent = `约 ${seconds(sourceText.value)} 秒`;
  $("#outputCount").textContent = `${resultCount} 字`;
  const change = sourceCount ? Math.round(((resultCount - sourceCount) / sourceCount) * 100) : 0;
  $("#delta").textContent = `与原文 ${change > 0 ? "+" : ""}${change}%`;
}

function compose() {
  if (!state.analysis) return;
  outputText.value = state.analysis.modules
    .map((module, index) => module.variants[state.selected[index]] || module.original)
    .join("\n\n");
  updateMetrics();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

function render() {
  const data = state.analysis;
  $("#emptyState").classList.add("hidden");
  $("#analysis").classList.remove("hidden");
  $("#themeInput").value = data.theme;
  $("#thesisText").textContent = data.thesis;
  $("#facts").innerHTML = data.lockedFacts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("");
  $("#shuffleBtn").disabled = false;
  $("#copyBtn").disabled = false;
  $("#exportBtn").disabled = false;
  $("#moduleList").innerHTML = data.modules.map((module, index) => `
    <article class="module ${state.locked[index] ? "locked" : ""}" data-index="${index}">
      <div class="module-top">
        <span class="module-no">${String(index + 1).padStart(2, "0")}</span>
        <div><h3>${escapeHtml(module.label)}</h3><p>${escapeHtml(module.purpose)}</p></div>
        <button class="lock-btn">${state.locked[index] ? "已锁" : "锁定"}</button>
      </div>
      <div class="original"><small>原文 · ${module.targetChars} 字</small>${escapeHtml(module.original)}</div>
      <div class="variants">
        ${module.variants.map((variant, variantIndex) => {
          const diff = count(variant) - module.targetChars;
          return `<button class="variant ${state.selected[index] === variantIndex ? "active" : ""}" data-variant="${variantIndex}">
            <span>${String.fromCharCode(65 + variantIndex)}</span>
            <b>${escapeHtml(variant)}</b>
            <small>${count(variant)} 字 · ${diff > 0 ? "+" : ""}${diff}</small>
          </button>`;
        }).join("")}
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".variant").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".module").dataset.index);
      state.selected[index] = Number(button.dataset.variant);
      render();
      compose();
    });
  });
  document.querySelectorAll(".lock-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".module").dataset.index);
      state.locked[index] = !state.locked[index];
      render();
    });
  });
}

$("#sampleBtn").onclick = () => { sourceText.value = sample; updateMetrics(); };
sourceText.addEventListener("input", updateMetrics);
outputText.addEventListener("input", updateMetrics);

$("#analyzeBtn").onclick = () => {
  if (!sourceText.value.trim()) return toast("请先粘贴文案", true);
  $("#analyzeBtn").disabled = true;
  $("#analyzeBtn").textContent = "正在拆解……";
  try {
    state.analysis = analyze(sourceText.value);
    state.selected = state.analysis.modules.map(() => 0);
    state.locked = state.analysis.modules.map(() => false);
    render();
    compose();
    toast("主题与功能模块已拆解");
  } finally {
    $("#analyzeBtn").disabled = false;
    $("#analyzeBtn").textContent = "提取主题并拆解";
  }
};

$("#shuffleBtn").onclick = () => {
  state.analysis.modules.forEach((module, index) => {
    if (!state.locked[index]) state.selected[index] = (state.selected[index] + 1) % module.variants.length;
  });
  render();
  compose();
};

$("#copyBtn").onclick = async () => {
  await navigator.clipboard.writeText(outputText.value);
  toast("已复制组合文案");
};

$("#exportBtn").onclick = () => {
  const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${($("#themeInput").value || "口播文案").replace(/[\\/:*?"<>|]/g, "_")}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
};

updateMetrics();
