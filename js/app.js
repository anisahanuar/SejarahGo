(() => {
  "use strict";

  const DATA = window.SG_DATA;
  const STORAGE_KEY = "sejarahgo_v4_multi_mission";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sample = (array) => array[Math.floor(Math.random() * array.length)];
  const shuffle = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const format = (template, values = {}) =>
    Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

  const defaultState = () => ({
    language: "ms",
    sound: true,
    music: true,
    volume: 0.65,
    reduceMotion: false,
    player: {
      name: "",
      character: "amir",
      style: "cartoon",
      stylesUsed: ["cartoon"]
    },
    progress: {
      unlockedStage: 1,
      completed: {},
      coins: 70,
      xp: 0,
      totalScore: 0,
      badges: []
    },
    leaderboard: []
  });

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!stored) return defaultState();
      const base = defaultState();
      return {
        ...base,
        ...stored,
        player: {...base.player, ...(stored.player || {})},
        progress: {...base.progress, ...(stored.progress || {})}
      };
    } catch (error) {
      console.warn("Unable to load save data:", error);
      return defaultState();
    }
  }

  let state = loadState();
  let currentScreen = "splashScreen";
  let carouselIndex = Math.max(0, DATA.characters.findIndex((c) => c.id === state.player.character));
  let previewStyle = state.player.style;
  let currentStage = null;
  let runner = null;
  let currentChallenge = null;
  let challengeInterval = null;
  let challengeSeconds = 30;
  let confirmCallback = null;

  const screens = $$(".screen");
  const topBar = $("#topBar");

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateResources();
  }

  function tr(key, values) {
    const value = DATA.t[state.language]?.[key] ?? DATA.t.ms[key] ?? key;
    return values ? format(value, values) : value;
  }

  function localize(value) {
    if (typeof value === "string") return value;
    return value?.[state.language] ?? value?.ms ?? "";
  }

  function characterAsset(style = state.player.style, character = state.player.character) {
    return `assets/characters/${style}-${character}.svg`;
  }

  function currentCharacter() {
    return DATA.characters.find((character) => character.id === state.player.character) || DATA.characters[0];
  }

  class AudioManager {
    constructor() {
      this.context = null;
      this.master = null;
      this.musicTimer = null;
      this.musicStep = 0;
    }

    ensure() {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") this.context.resume();
      this.master.gain.value = state.volume * 0.22;
      return true;
    }

    tone(frequency, duration = 0.08, type = "sine", gain = 0.18, delay = 0) {
      if (!state.sound || !this.ensure()) return;
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    click() { this.tone(420, 0.05, "triangle", 0.11); }
    coin() { this.tone(880, 0.08, "sine", 0.15); this.tone(1320, 0.1, "sine", 0.1, 0.05); }
    correct() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.14, i * 0.08)); }
    wrong() { this.tone(180, 0.22, "sawtooth", 0.12); }
    hit() { this.tone(90, 0.15, "square", 0.13); }
    level() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.12, i * 0.09)); }

    setVolume() {
      if (this.master) this.master.gain.value = state.volume * 0.22;
    }

    startMusic() {
      if (!state.music || this.musicTimer || !this.ensure()) return;
      const notes = [196, 247, 294, 247, 220, 262, 330, 262];
      this.musicTimer = window.setInterval(() => {
        if (!state.music || currentScreen === "runnerScreen") return;
        const frequency = notes[this.musicStep % notes.length];
        this.tone(frequency, 0.34, "sine", 0.026);
        if (this.musicStep % 2 === 0) this.tone(frequency / 2, 0.42, "triangle", 0.018);
        this.musicStep += 1;
      }, 620);
    }

    stopMusic() {
      if (this.musicTimer) window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  const audio = new AudioManager();

  function updateTranslations() {
    document.documentElement.lang = state.language === "ms" ? "ms" : "en";
    $$("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (DATA.t[state.language][key]) element.textContent = tr(key);
    });
    $$("[data-language]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.language === state.language);
    });

    const input = $("#playerNameInput");
    if (input) input.placeholder = state.language === "ms" ? "Contoh: Anisah" : "Example: Anisah";
    const characterNameInput = $("#characterNameInput");
    if (characterNameInput) characterNameInput.placeholder = state.language === "ms" ? "Masukkan nama sendiri" : "Enter your own name";

    updateHomeCharacter();
    renderCharacterCarousel();
    renderMap();
    renderLeaderboard();
    renderAchievements();
    syncSettings();
  }

  function updateResources() {
    $("#coinDisplay").textContent = state.progress.coins;
    $("#xpDisplay").textContent = state.progress.xp;
    $("#profileAvatar").src = characterAsset();
    $("#profilePreviewAvatar").src = characterAsset(previewStyle, DATA.characters[carouselIndex].id);
    $("#profilePreviewName").textContent = state.player.name || tr("defaultPlayerName");
    const characterNameInput = $("#characterNameInput");
    if (characterNameInput && document.activeElement !== characterNameInput) characterNameInput.value = state.player.name || "";
  }

  function showScreen(id) {
    screens.forEach((screen) => screen.classList.toggle("is-active", screen.id === id));
    currentScreen = id;
    const hideTop = ["splashScreen", "homeScreen", "runnerScreen"].includes(id);
    topBar.classList.toggle("is-hidden", hideTop);
    document.body.classList.toggle("no-scroll", id === "runnerScreen");

    if (id === "homeScreen") updateHomeCharacter();
    if (id === "characterScreen") renderCharacterCarousel();
    if (id === "mapScreen") renderMap();
    if (id === "leaderboardScreen") renderLeaderboard();
    if (id === "achievementScreen") renderAchievements();
    if (id === "settingsScreen") syncSettings();

    if (id !== "runnerScreen" && state.music) audio.startMusic();
    if (id === "runnerScreen") audio.stopMusic();
    window.scrollTo({top: 0, behavior: state.reduceMotion ? "auto" : "smooth"});
  }

  function toast(icon, title, message = "") {
    const element = document.createElement("div");
    element.className = "toast";
    element.innerHTML = `<span>${icon}</span><div><b>${title}</b>${message ? `<small>${message}</small>` : ""}</div>`;
    $("#toastStack").appendChild(element);
    window.setTimeout(() => {
      element.style.opacity = "0";
      element.style.transform = "translateX(120%)";
      window.setTimeout(() => element.remove(), 240);
    }, 2800);
  }

  function updateHomeCharacter() {
    const character = currentCharacter();
    $("#heroCharacter").src = characterAsset();
    $("#heroCharacterName").textContent = state.player.name.trim() || tr("defaultPlayerName");
    $("#heroCharacterRole").textContent = localize(character.role);
    $("#heroStyleBadge").textContent = state.player.style === "cartoon" ? tr("styleCartoon") : tr("styleExplorer");
    $("#profileAvatar").src = characterAsset();
  }

  function navigate(action) {
    audio.click();
    switch (action) {
      case "home":
        showScreen("homeScreen");
        break;
      case "play":
        if (!state.player.name.trim()) {
          $("#playerNameInput").value = "";
          showScreen("profileScreen");
        } else {
          showScreen("mapScreen");
        }
        break;
      case "characters":
        carouselIndex = Math.max(0, DATA.characters.findIndex((c) => c.id === state.player.character));
        previewStyle = state.player.style;
        showScreen("characterScreen");
        break;
      case "leaderboard":
        showScreen("leaderboardScreen");
        break;
      case "achievements":
        showScreen("achievementScreen");
        break;
      case "settings":
        showScreen("settingsScreen");
        break;
      default:
        break;
    }
  }

  function setLanguage(language, notify = true) {
    if (!DATA.t[language]) return;
    state.language = language;
    saveState();
    updateTranslations();
    if (notify) toast("🌐", tr("languageChanged"), language === "ms" ? "Bahasa Melayu" : "English");
  }

  function renderCharacterCarousel() {
    const carousel = $("#characterCarousel");
    if (!carousel) return;
    const positions = ["is-far-left", "is-left", "is-center", "is-right", "is-far-right"];
    carousel.innerHTML = "";

    DATA.characters.forEach((character, index) => {
      let relative = index - carouselIndex;
      if (relative > 2) relative -= DATA.characters.length;
      if (relative < -2) relative += DATA.characters.length;
      const positionClass = positions[relative + 2] || "is-far-right";
      const card = document.createElement("button");
      card.className = `character-card ${positionClass}`;
      card.dataset.characterIndex = String(index);
      card.setAttribute("aria-label", `${localize(character.name)} — ${localize(character.role)}`);
      card.innerHTML = `<img src="${characterAsset(previewStyle, character.id)}" alt="${localize(character.name)}" />`;
      carousel.appendChild(card);
    });

    const character = DATA.characters[carouselIndex];
    $("#characterVariant").textContent = localize(character.name);
    $("#characterDescription").textContent = localize(character.description);
    const characterNameInput = $("#characterNameInput");
    if (characterNameInput && document.activeElement !== characterNameInput) characterNameInput.value = state.player.name || "";
    $("#abilityIcon").textContent = character.icon;
    $("#abilityName").textContent = localize(character.ability);
    $("#abilityDescription").textContent = localize(character.abilityDescription);
    $("#characterStyleLabel").textContent = previewStyle === "cartoon" ? tr("styleCartoon") : tr("styleExplorer");
    $("#profilePreviewAvatar").src = characterAsset(previewStyle, character.id);
    $$(".style-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.style === previewStyle));
  }

  function moveCarousel(direction) {
    carouselIndex = (carouselIndex + direction + DATA.characters.length) % DATA.characters.length;
    audio.click();
    renderCharacterCarousel();
  }

  function selectCharacter() {
    const character = DATA.characters[carouselIndex];
    const customName = $("#characterNameInput").value.trim();
    if (!customName) {
      toast("✍️", tr("noName"));
      $("#characterNameInput").focus();
      return;
    }
    state.player.name = customName;
    state.player.character = character.id;
    state.player.style = previewStyle;
    state.player.stylesUsed = [...new Set([...(state.player.stylesUsed || []), previewStyle])];
    saveState();
    updateHomeCharacter();
    checkAchievements();
    toast("✨", tr("characterSelected"), `${customName} · ${localize(character.role)} · ${previewStyle === "cartoon" ? tr("styleCartoon") : tr("styleExplorer")}`);
    showScreen("homeScreen");
  }

  function renderMap() {
    const legend = $("#chapterLegend");
    const nodes = $("#mapNodes");
    if (!legend || !nodes) return;

    const completedCount = Object.keys(state.progress.completed).length;
    $("#mapProgressText").textContent = tr("progressSummary", {done: completedCount});
    $("#mapRunnerImage").src = characterAsset();

    legend.innerHTML = DATA.chapters.map((chapter) => {
      const chapterStages = DATA.stages.filter((stage) => stage.chapter === chapter.id);
      const done = chapterStages.filter((stage) => state.progress.completed[stage.id]).length;
      const current = chapterStages.some((stage) => stage.id === state.progress.unlockedStage);
      return `
        <div class="chapter-card ${current ? "is-current" : ""}">
          <span>${chapter.icon}</span>
          <div>
            <b>${tr("chapter")} ${chapter.id}: ${localize(chapter.title)}</b>
            <small>${done}/3 ${tr("completed").toLowerCase()}</small>
          </div>
        </div>`;
    }).join("");

    nodes.innerHTML = DATA.stages.map((stage) => {
      const unlocked = stage.id <= state.progress.unlockedStage;
      const completed = state.progress.completed[stage.id];
      const current = stage.id === state.progress.unlockedStage && !completed;
      const stars = completed ? "★".repeat(completed.stars) + "☆".repeat(3 - completed.stars) : "☆☆☆";
      return `
        <button class="map-node ${completed ? "is-completed" : ""} ${current ? "is-current" : ""} ${!unlocked ? "is-locked" : ""}"
          style="left:${stage.x}%;top:${stage.y}%"
          data-stage-id="${stage.id}" ${!unlocked ? "disabled" : ""}>
          <span class="node-icon">${stage.icon}</span>
          <span class="node-label">${tr("mission")} ${stage.id}</span>
          <span class="node-game">${DATA.gameTypes[stage.gameType].icon} ${tr(DATA.gameTypes[stage.gameType].labelKey)}</span>
          <span class="node-stars">${stars}</span>
          ${!unlocked ? `<span class="node-lock">🔒</span>` : ""}
        </button>`;
    }).join("");

    const targetStage = DATA.stages.find((stage) => stage.id === Math.min(state.progress.unlockedStage, 9)) || DATA.stages[0];
    const mapRunner = $("#mapRunner");
    mapRunner.style.left = `calc(${targetStage.x}% + 22px)`;
    mapRunner.style.top = `calc(${targetStage.y}% - 78px)`;
  }

  function stageById(id) {
    return DATA.stages.find((stage) => stage.id === Number(id));
  }

  function startStage(stage) {
    if (!stage || stage.id > state.progress.unlockedStage) {
      toast("🔒", tr("lockedMission"));
      return;
    }
    currentStage = stage;
    showScreen("runnerScreen");

    const chapter = DATA.chapters.find((item) => item.id === stage.chapter);
    $("#runnerChapterLabel").textContent = `${tr("chapter").toUpperCase()} ${chapter.id} · ${localize(chapter.title).toUpperCase()}`;
    $("#runnerStageTitle").textContent = `${tr("mission")} ${stage.id}: ${localize(stage.title)}`;
    const gameMeta = DATA.gameTypes[stage.gameType];
    $("#missionObjectiveText").textContent = tr("challengeObjective", {game: tr(gameMeta.labelKey)});
    const calloutIcon = $("#missionCallout > span");
    if (calloutIcon) calloutIcon.textContent = gameMeta.icon;
    $("#artifactGoal").textContent = stage.goal;
    $("#artifactCount").textContent = "0";
    $("#runCoinDisplay").textContent = "0";
    $("#timeDisplay").textContent = stage.time;
    $("#runnerProgressBar").style.width = "0%";
    $("#missionCallout").classList.remove("is-hidden");

    runner?.destroy();
    runner = new Runner($("#gameCanvas"), stage);
    runner.start();
    window.setTimeout(() => $("#missionCallout").classList.add("is-hidden"), 4500);
  }

  class Runner {
    constructor(canvas, stage) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.stage = stage;
      this.running = false;
      this.paused = false;
      this.lastTime = 0;
      this.elapsed = 0;
      this.spawnElapsed = 0;
      this.lane = 1;
      this.targetLane = 1;
      this.jump = 0;
      this.slide = 0;
      this.invincible = 0;
      this.items = [];
      this.particles = [];
      this.runCoins = 0;
      this.score = 0;
      this.lives = currentCharacter().abilityKey === "extraLife" ? 4 : 3;
      this.artifacts = 0;
      this.answers = 0;
      this.correctAnswers = 0;
      this.questionIds = [];
      this.freeHintAvailable = currentCharacter().abilityKey === "freeHint";
      this.playerImage = new Image();
      this.playerImage.src = characterAsset();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = 0;
      this.height = 0;
      this.boundResize = () => this.resize();
      this.boundFrame = (time) => this.frame(time);
      this.swipeStart = null;
      this.bindInput();
      this.resize();
    }

    bindInput() {
      window.addEventListener("resize", this.boundResize);
      this.keyHandler = (event) => {
        if (!this.running || this.paused || !$("#challengeModal").classList.contains("is-hidden")) return;
        const key = event.key.toLowerCase();
        if (["arrowleft", "a"].includes(key)) this.control("left");
        if (["arrowright", "d"].includes(key)) this.control("right");
        if (["arrowup", "w", " "].includes(key)) {
          event.preventDefault();
          this.control("jump");
        }
        if (["arrowdown", "s"].includes(key)) this.control("slide");
      };
      window.addEventListener("keydown", this.keyHandler);
      this.pointerDown = (event) => {
        const point = event.touches?.[0] || event;
        this.swipeStart = {x: point.clientX, y: point.clientY};
      };
      this.pointerUp = (event) => {
        if (!this.swipeStart) return;
        const point = event.changedTouches?.[0] || event;
        const dx = point.clientX - this.swipeStart.x;
        const dy = point.clientY - this.swipeStart.y;
        this.swipeStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        if (Math.abs(dx) > Math.abs(dy)) this.control(dx > 0 ? "right" : "left");
        else this.control(dy < 0 ? "jump" : "slide");
      };
      this.canvas.addEventListener("pointerdown", this.pointerDown);
      this.canvas.addEventListener("pointerup", this.pointerUp);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(320, rect.width);
      this.height = Math.max(520, rect.height);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    start() {
      this.running = true;
      this.lastTime = performance.now();
      $("#lifeDisplay").textContent = this.lives;
      requestAnimationFrame(this.boundFrame);
    }

    destroy() {
      this.running = false;
      window.removeEventListener("resize", this.boundResize);
      window.removeEventListener("keydown", this.keyHandler);
      this.canvas.removeEventListener("pointerdown", this.pointerDown);
      this.canvas.removeEventListener("pointerup", this.pointerUp);
    }

    control(action) {
      if (!this.running || this.paused) return;
      if (action === "left") this.targetLane = clamp(this.targetLane - 1, 0, 2);
      if (action === "right") this.targetLane = clamp(this.targetLane + 1, 0, 2);
      if (action === "jump" && this.jump <= 0) {
        this.jump = 0.78;
        audio.tone(340, 0.08, "triangle", 0.08);
      }
      if (action === "slide" && this.slide <= 0 && this.jump <= 0) this.slide = 0.62;
    }

    pause(value = true) {
      this.paused = value;
      if (!value) this.lastTime = performance.now();
    }

    frame(time) {
      if (!this.running) return;
      let dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;
      if (!this.paused) this.update(dt);
      this.draw();
      requestAnimationFrame(this.boundFrame);
    }

    update(dt) {
      this.elapsed += dt;
      this.spawnElapsed += dt;
      this.lane += (this.targetLane - this.lane) * Math.min(1, dt * 12);
      this.jump = Math.max(0, this.jump - dt);
      this.slide = Math.max(0, this.slide - dt);
      this.invincible = Math.max(0, this.invincible - dt);

      const remaining = Math.max(0, this.stage.time - Math.floor(this.elapsed));
      $("#timeDisplay").textContent = remaining;
      if (remaining <= 0) {
        this.finish(false, "time");
        return;
      }

      const spawnRate = clamp(0.72 - (this.stage.speed - 0.28) * 1.8, 0.42, 0.75);
      if (this.spawnElapsed >= spawnRate) {
        this.spawnElapsed = 0;
        this.spawnItem();
      }

      const travel = dt * (0.42 + this.stage.speed);
      this.items.forEach((item) => {
        item.depth += travel * item.speed;
        item.rotation += dt * 2.4;
      });
      this.items = this.items.filter((item) => item.depth < 1.2 && !item.remove);

      this.particles.forEach((particle) => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        particle.vy += 120 * dt;
      });
      this.particles = this.particles.filter((particle) => particle.life > 0);

      this.checkCollisions();
      $("#runnerProgressBar").style.width = `${Math.min(100, (this.artifacts / this.stage.goal) * 100)}%`;
    }

    spawnItem() {
      const roll = Math.random();
      let kind = "coin";
      if (roll > 0.74 && roll <= 0.87) kind = "obstacle";
      if (roll > 0.87) kind = "artifact";
      const lane = Math.floor(Math.random() * 3);
      const item = {
        kind,
        lane,
        depth: 0.02,
        speed: 0.95 + Math.random() * 0.12,
        rotation: Math.random() * Math.PI * 2,
        remove: false,
        checked: false,
        obstacleType: Math.random() > 0.5 ? "barrier" : "arch"
      };
      if (kind === "artifact" && this.items.some((entry) => entry.kind === "artifact")) item.kind = "coin";
      this.items.push(item);

      if (item.kind === "coin" && Math.random() > 0.58) {
        for (let index = 1; index <= 2; index += 1) {
          this.items.push({...item, depth: -0.075 * index, rotation: item.rotation + index, checked: false});
        }
      }
    }

    projected(item) {
      const horizonY = this.height * 0.25;
      const bottomY = this.height * 0.92;
      const perspective = Math.pow(clamp(item.depth, 0, 1), 1.5);
      const roadHalfTop = this.width * 0.07;
      const roadHalfBottom = Math.min(this.width * 0.43, 480);
      const roadHalf = roadHalfTop + (roadHalfBottom - roadHalfTop) * perspective;
      const laneOffset = (item.lane - 1) * roadHalf * 0.66;
      return {
        x: this.width / 2 + laneOffset,
        y: horizonY + (bottomY - horizonY) * perspective,
        scale: 0.2 + perspective * 1.08
      };
    }

    playerPosition() {
      const roadHalfBottom = Math.min(this.width * 0.43, 480);
      const x = this.width / 2 + (this.lane - 1) * roadHalfBottom * 0.66;
      const baseY = this.height * 0.82;
      const jumpProgress = this.jump > 0 ? Math.sin((this.jump / 0.78) * Math.PI) : 0;
      return {
        x,
        y: baseY - jumpProgress * Math.min(145, this.height * 0.18),
        jumping: this.jump > 0.1,
        sliding: this.slide > 0
      };
    }

    checkCollisions() {
      const player = this.playerPosition();
      this.items.forEach((item) => {
        if (item.checked || item.depth < 0.8 || item.depth > 1.06) return;
        const p = this.projected(item);
        const magnet = currentCharacter().abilityKey === "coinMagnet" && item.kind === "coin" ? 95 : 48;
        const laneDistance = Math.abs(p.x - player.x);
        if (laneDistance > magnet) return;
        item.checked = true;

        if (item.kind === "coin") {
          item.remove = true;
          this.runCoins += 5;
          this.score += 20;
          audio.coin();
          this.emitParticles(p.x, p.y, "#ffd166", 9);
          $("#runCoinDisplay").textContent = this.runCoins;
          return;
        }

        if (item.kind === "artifact") {
          item.remove = true;
          this.pause(true);
          this.openChallenge();
          return;
        }

        const avoided =
          (item.obstacleType === "barrier" && player.jumping) ||
          (item.obstacleType === "arch" && player.sliding);

        if (!avoided && this.invincible <= 0) {
          this.lives -= 1;
          this.invincible = 1.25;
          audio.hit();
          this.emitParticles(player.x, player.y, "#ff5d73", 15);
          $("#lifeDisplay").textContent = this.lives;
          if (this.lives <= 0) this.finish(false, "lives");
        } else if (avoided) {
          this.score += 35;
        }
      });
    }

    emitParticles(x, y, color, count) {
      for (let index = 0; index < count; index += 1) {
        this.particles.push({
          x, y, color,
          vx: (Math.random() - 0.5) * 180,
          vy: -40 - Math.random() * 130,
          life: 0.45 + Math.random() * 0.45,
          size: 2 + Math.random() * 5
        });
      }
    }

    openChallenge() {
      openChallengeForRunner(this);
    }

    answerCorrect(accuracy = 100, bonus = 0) {
      this.answers += 1;
      this.correctAnswers += clamp(accuracy, 0, 100) / 100;
      this.artifacts += 1;
      this.score += Math.round(210 + accuracy * 1.25 + bonus);
      this.runCoins += 25;
      $("#artifactCount").textContent = this.artifacts;
      $("#runCoinDisplay").textContent = this.runCoins;
      if (this.artifacts >= this.stage.goal) {
        window.setTimeout(() => this.finish(true), 650);
      } else {
        window.setTimeout(() => this.pause(false), 650);
      }
    }

    answerWrong(accuracy = 0) {
      this.answers += 1;
      this.correctAnswers += clamp(accuracy, 0, 100) / 100;
      this.lives -= 1;
      $("#lifeDisplay").textContent = this.lives;
      if (this.lives <= 0) {
        window.setTimeout(() => this.finish(false, "lives"), 650);
      } else {
        window.setTimeout(() => this.pause(false), 650);
      }
    }

    finish(success, reason = "") {
      if (!this.running) return;
      this.running = false;
      this.paused = true;
      closeChallenge();
      const accuracy = this.answers ? Math.round((this.correctAnswers / this.answers) * 100) : 0;
      const remaining = Math.max(0, this.stage.time - Math.floor(this.elapsed));
      let stars = 0;
      if (success) {
        stars = 1;
        if (accuracy >= 80 && this.lives >= 2) stars = 2;
        if (accuracy === 100 && remaining >= Math.floor(this.stage.time * 0.28)) stars = 3;
      }
      showResult({
        success,
        reason,
        stage: this.stage,
        score: Math.max(0, Math.round(this.score + (success ? remaining * 8 + this.lives * 70 : 0))),
        coins: this.runCoins + (success ? stars * 15 : 0),
        accuracy,
        stars
      });
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawBackground(ctx);
      this.drawRoad(ctx);
      const sorted = [...this.items].sort((a, b) => a.depth - b.depth);
      sorted.forEach((item) => this.drawItem(ctx, item));
      this.drawPlayer(ctx);
      this.particles.forEach((particle) => {
        ctx.globalAlpha = clamp(particle.life * 1.6, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    drawBackground(ctx) {
      const chapter = DATA.chapters.find((item) => item.id === this.stage.chapter);
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      if (chapter.id === 2) {
        gradient.addColorStop(0, "#081b37");
        gradient.addColorStop(0.55, "#236e91");
        gradient.addColorStop(1, "#bde9f2");
      } else if (chapter.id === 3) {
        gradient.addColorStop(0, "#0a1730");
        gradient.addColorStop(0.55, "#845b37");
        gradient.addColorStop(1, "#d99a55");
      } else {
        gradient.addColorStop(0, "#160d35");
        gradient.addColorStop(0.55, "#5a3d73");
        gradient.addColorStop(1, "#c78765");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      const sunX = this.width * 0.74;
      const sunY = this.height * 0.19;
      const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 110);
      sun.addColorStop(0, "rgba(255,238,170,.82)");
      sun.addColorStop(1, "rgba(255,209,102,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(sunX - 120, sunY - 120, 240, 240);

      const shift = (this.elapsed * 18) % 180;
      ctx.fillStyle = "rgba(5,18,31,.42)";
      for (let x = -180 - shift; x < this.width + 250; x += 180) {
        const base = this.height * 0.32;
        ctx.beginPath();
        if (chapter.id === 2) {
          ctx.moveTo(x, base + 40); ctx.lineTo(x + 80, base - 70); ctx.lineTo(x + 170, base + 40);
        } else if (chapter.id === 3) {
          ctx.moveTo(x, base + 42); ctx.quadraticCurveTo(x + 80, base - 40, x + 170, base + 42);
        } else {
          ctx.rect(x + 35, base - 45, 100, 88);
          ctx.moveTo(x + 15, base - 45); ctx.lineTo(x + 85, base - 105); ctx.lineTo(x + 155, base - 45);
        }
        ctx.fill();
      }

      for (let i = 0; i < 28; i += 1) {
        const x = (i * 137 + this.elapsed * (4 + i % 3)) % this.width;
        const y = (i * 73) % (this.height * 0.48);
        ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 4) * 0.025})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawRoad(ctx) {
      const horizonY = this.height * 0.25;
      const bottomY = this.height;
      const center = this.width / 2;
      const halfBottom = Math.min(this.width * 0.48, 560);
      const halfTop = this.width * 0.05;

      ctx.fillStyle = "rgba(6,17,31,.82)";
      ctx.beginPath();
      ctx.moveTo(center - halfTop, horizonY);
      ctx.lineTo(center + halfTop, horizonY);
      ctx.lineTo(center + halfBottom, bottomY);
      ctx.lineTo(center - halfBottom, bottomY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255,209,102,.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(center - halfTop, horizonY);
      ctx.lineTo(center - halfBottom, bottomY);
      ctx.moveTo(center + halfTop, horizonY);
      ctx.lineTo(center + halfBottom, bottomY);
      ctx.stroke();

      const stripeOffset = (this.elapsed * (0.8 + this.stage.speed)) % 1;
      for (let index = 0; index < 14; index += 1) {
        const depth = ((index / 14) + stripeOffset) % 1;
        const p1 = Math.pow(depth, 1.65);
        const p2 = Math.pow(Math.min(1, depth + 0.035), 1.65);
        const y1 = horizonY + (bottomY - horizonY) * p1;
        const y2 = horizonY + (bottomY - horizonY) * p2;
        const road1 = halfTop + (halfBottom - halfTop) * p1;
        const road2 = halfTop + (halfBottom - halfTop) * p2;
        ctx.fillStyle = index % 2 ? "rgba(255,255,255,.12)" : "rgba(45,212,191,.16)";
        [-1 / 3, 1 / 3].forEach((factor) => {
          ctx.beginPath();
          ctx.moveTo(center + road1 * factor - 1, y1);
          ctx.lineTo(center + road1 * factor + 1, y1);
          ctx.lineTo(center + road2 * factor + 4, y2);
          ctx.lineTo(center + road2 * factor - 4, y2);
          ctx.fill();
        });
      }
    }

    drawItem(ctx, item) {
      if (item.depth < 0) return;
      const p = this.projected(item);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      if (item.kind === "coin") {
        ctx.rotate(item.rotation);
        const coinGradient = ctx.createRadialGradient(-5, -6, 2, 0, 0, 25);
        coinGradient.addColorStop(0, "#fff8c6");
        coinGradient.addColorStop(0.35, "#ffd166");
        coinGradient.addColorStop(1, "#d98d00");
        ctx.fillStyle = coinGradient;
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff0a1"; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = "#8a5800"; ctx.font = "900 22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("S", 0, 1);
      } else if (item.kind === "artifact") {
        ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 28;
        ctx.font = "54px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(this.stage.gameIcon || "🏺", 0, 0);
      } else if (item.obstacleType === "barrier") {
        ctx.fillStyle = "#ff5d73";
        ctx.strokeStyle = "#ffd3da";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(-44, -30, 88, 60, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff";
        for (let x = -35; x < 38; x += 28) ctx.fillRect(x, -27, 12, 54);
      } else {
        ctx.fillStyle = "#4d2e67";
        ctx.strokeStyle = "#c4a7e7";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-52, 45); ctx.lineTo(-52, -30); ctx.quadraticCurveTo(0, -78, 52, -30); ctx.lineTo(52, 45);
        ctx.lineTo(30, 45); ctx.lineTo(30, -20); ctx.quadraticCurveTo(0, -50, -30, -20); ctx.lineTo(-30, 45);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    drawPlayer(ctx) {
      const player = this.playerPosition();
      const sliding = player.sliding;
      const width = sliding ? 116 : 108;
      const height = sliding ? 108 : 205;
      ctx.save();
      ctx.translate(player.x, player.y);
      if (this.invincible > 0 && Math.floor(this.invincible * 12) % 2 === 0) ctx.globalAlpha = 0.35;
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 18;
      if (this.playerImage.complete) {
        ctx.drawImage(this.playerImage, -width / 2, -height, width, height);
      } else {
        ctx.fillStyle = "#ffd166";
        ctx.beginPath(); ctx.arc(0, -70, 34, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(player.x, this.height * 0.86, sliding ? 54 : 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function setChallengeFeedback(message = "", kind = "") {
    const feedback = $("#challengeFeedback");
    feedback.textContent = message;
    feedback.className = `quiz-feedback ${kind}`.trim();
  }

  function challengeMeta(stage) {
    return DATA.gameTypes[stage.gameType] || DATA.gameTypes.mcq;
  }

  function openChallengeForRunner(activeRunner) {
    const stage = activeRunner.stage;
    const meta = challengeMeta(stage);
    currentChallenge = {
      runner: activeRunner,
      stage,
      type: stage.gameType,
      resolved: false,
      state: {}
    };

    $("#challengeTypeIcon").textContent = meta.icon;
    $("#challengeHeroIcon").textContent = meta.icon;
    $("#challengeTypeLabel").textContent = tr(meta.labelKey);
    $("#challengeMissionLabel").textContent = `${tr("mission").toUpperCase()} ${stage.id}`;
    $("#challengeTitle").textContent = localize(stage.title);
    $("#challengeInstruction").textContent = tr(`${stage.gameType}Help`) || tr("challengeInstruction");
    $("#challengeBody").className = "challenge-body";
    setChallengeFeedback();
    updateHintCost();
    renderCurrentChallenge();
    $("#challengeModal").classList.remove("is-hidden");

    challengeSeconds = (stage.challenge?.time || 45) + (currentCharacter().abilityKey === "extraTime" ? 5 : 0);
    $("#challengeTimer").textContent = challengeSeconds;
    clearInterval(challengeInterval);
    challengeInterval = window.setInterval(() => {
      challengeSeconds -= 1;
      $("#challengeTimer").textContent = challengeSeconds;
      if (challengeSeconds <= 0) {
        clearInterval(challengeInterval);
        resolveChallenge(false, currentChallenge?.state?.partialAccuracy || 0, tr("timeUpAnswer"));
      }
    }, 1000);
  }

  function renderCurrentChallenge() {
    if (!currentChallenge) return;
    switch (currentChallenge.type) {
      case "mcq": renderMCQ(); break;
      case "timeline": renderTimeline(); break;
      case "puzzle": renderPuzzle(); break;
      case "trueFalse": renderTrueFalse(); break;
      case "wordSearch": renderWordSearch(); break;
      case "crossword": renderCrossword(); break;
      case "scramble": renderScramble(); break;
      case "matching": renderMatching(); break;
      case "written": renderWritten(); break;
      default: renderMCQ();
    }
  }

  function resolveChallenge(success, accuracy = success ? 100 : 0, message = "") {
    if (!currentChallenge || currentChallenge.resolved) return;
    currentChallenge.resolved = true;
    clearInterval(challengeInterval);
    $("#challengeBody").classList.add("is-locked");
    setChallengeFeedback(message || (success ? tr("correctChallenge") : tr("wrongChallenge")), success ? "correct" : "wrong");
    if (success) audio.correct(); else audio.wrong();
    const activeRunner = currentChallenge.runner;
    window.setTimeout(() => {
      closeChallenge();
      if (success) activeRunner.answerCorrect(accuracy);
      else activeRunner.answerWrong(accuracy);
    }, 900);
  }

  function closeChallenge() {
    clearInterval(challengeInterval);
    $("#challengeModal").classList.add("is-hidden");
    $("#challengeBody").innerHTML = "";
    currentChallenge = null;
  }

  function updateHintCost() {
    if (!currentChallenge) return;
    const activeRunner = currentChallenge.runner;
    $("#hintCost").textContent = activeRunner.freeHintAvailable
      ? (state.language === "ms" ? "PERCUMA" : "FREE")
      : "−25 🪙";
  }

  function consumeHint() {
    if (!currentChallenge || currentChallenge.resolved) return false;
    const activeRunner = currentChallenge.runner;
    if (activeRunner.freeHintAvailable) {
      activeRunner.freeHintAvailable = false;
      toast("💡", tr("freeHint"));
    } else {
      if (state.progress.coins < 25) {
        toast("🪙", tr("notEnoughCoins"));
        return false;
      }
      state.progress.coins -= 25;
      saveState();
    }
    $("#hintCost").textContent = state.language === "ms" ? "DIGUNA" : "USED";
    return true;
  }

  function useHint() {
    if (!consumeHint()) return;
    const challenge = currentChallenge;
    const challengeState = challenge.state;
    switch (challenge.type) {
      case "mcq": {
        const wrong = challengeState.options
          .map((item, index) => ({item, index}))
          .filter(({item}) => !item.correct)
          .map(({index}) => index);
        shuffle(wrong).slice(0, 2).forEach((index) => {
          $(`[data-mg-answer="${index}"]`)?.classList.add("is-disabled");
        });
        setChallengeFeedback(tr("hintUsed"), "correct");
        break;
      }
      case "timeline": {
        const expected = challenge.stage.challenge.order;
        const firstId = expected[0];
        const item = challengeState.items.find((entry) => entry.id === firstId);
        challengeState.items = [item, ...challengeState.items.filter((entry) => entry.id !== firstId)];
        renderTimeline();
        setChallengeFeedback(tr("hintTimeline"), "correct");
        break;
      }
      case "puzzle":
        challengeState.puzzle = [1, 2, 3, 4, 5, 6, 7, 0, 8];
        renderPuzzle();
        setChallengeFeedback(tr("hintPuzzle"), "correct");
        break;
      case "trueFalse": {
        const statement = challenge.stage.challenge.statements[challengeState.index];
        challengeState.hintAnswer = statement.answer;
        renderTrueFalse();
        setChallengeFeedback(tr("hintTrueFalse"), "correct");
        break;
      }
      case "wordSearch": {
        const target = challengeState.placements.find((entry) => !challengeState.found.has(entry.word));
        if (target) challengeState.hintCell = target.cells[0];
        renderWordSearch();
        setChallengeFeedback(tr("hintWordSearch"), "correct");
        break;
      }
      case "crossword": {
        const empty = [...$("#challengeBody").querySelectorAll("[data-cw-cell]")]
          .find((input) => !input.value);
        if (empty) empty.value = empty.dataset.expected;
        setChallengeFeedback(tr("hintCrossword"), "correct");
        break;
      }
      case "scramble": {
        const terms = challenge.stage.challenge.terms[state.language];
        const term = terms[challengeState.index];
        challengeState.hint = `${term.answer[0]}${" _".repeat(Math.max(0, term.answer.length - 1))}`;
        renderScramble();
        setChallengeFeedback(tr("hintScramble"), "correct");
        break;
      }
      case "matching": {
        const pair = challenge.stage.challenge.pairs.find((entry) => !challengeState.matched.has(entry.id));
        if (pair) challengeState.matched.add(pair.id);
        renderMatching();
        if (challengeState.matched.size === challenge.stage.challenge.pairs.length) {
          resolveChallenge(true, 100, tr("correctChallenge"));
        } else {
          setChallengeFeedback(tr("hintMatching"), "correct");
        }
        break;
      }
      case "written": {
        const question = challenge.stage.challenge.questions[challengeState.index];
        const answer = question.answers[state.language][0];
        challengeState.hint = answer.split(" ").map((part) => `${part[0]}${"_".repeat(Math.max(0, part.length - 1))}`).join(" ");
        renderWritten();
        setChallengeFeedback(tr("hintWritten"), "correct");
        break;
      }
      default:
        break;
    }
  }

  function renderMCQ() {
    const challenge = currentChallenge;
    if (!challenge.state.source) {
      const source = sample(challenge.stage.questions);
      challenge.state.source = source;
      challenge.state.options = shuffle(source.options.map((option, index) => ({option, correct:index === source.answer})));
    }
    const {source, options} = challenge.state;
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${tr("gameMCQ")}</h3><p>${localize(source.context)}</p></div>
      <h3 class="mg-question">${localize(source.question)}</h3>
      <div class="mg-answer-grid">
        ${options.map((item, index) => `<button class="mg-answer" data-mg-answer="${index}"><span class="mg-letter">${String.fromCharCode(65 + index)}</span><span>${localize(item.option)}</span></button>`).join("")}
      </div>`;
  }

  function handleMCQAnswer(index) {
    if (!currentChallenge || currentChallenge.type !== "mcq" || currentChallenge.resolved) return;
    const chosen = currentChallenge.state.options[index];
    resolveChallenge(Boolean(chosen?.correct), chosen?.correct ? 100 : 0);
  }

  function renderTimeline() {
    const challenge = currentChallenge;
    if (!challenge.state.items) challenge.state.items = shuffle(challenge.stage.challenge.items);
    const items = challenge.state.items;
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${tr("gameTimeline")}</h3><p>${tr("timelineHelp")}</p></div>
      <div class="timeline-list">
        ${items.map((item, index) => `<div class="timeline-item">
          <span class="timeline-number">${index + 1}</span>
          <div class="timeline-copy">${localize(item.text)}</div>
          <div class="timeline-actions">
            <button data-timeline-move="-1" data-index="${index}" ${index === 0 ? "disabled" : ""} aria-label="${tr("moveUp")}">↑</button>
            <button data-timeline-move="1" data-index="${index}" ${index === items.length - 1 ? "disabled" : ""} aria-label="${tr("moveDown")}">↓</button>
          </div>
        </div>`).join("")}
      </div>
      <div class="timeline-submit"><button class="mg-primary" data-mg-submit="timeline">${tr("checkAnswer")}</button></div>`;
  }

  function moveTimeline(index, direction) {
    if (!currentChallenge || currentChallenge.type !== "timeline") return;
    const target = index + direction;
    const items = currentChallenge.state.items;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    renderTimeline();
  }

  function submitTimeline() {
    const items = currentChallenge.state.items;
    const expected = currentChallenge.stage.challenge.order;
    const correctPositions = items.filter((item, index) => item.id === expected[index]).length;
    const accuracy = Math.round((correctPositions / expected.length) * 100);
    resolveChallenge(correctPositions === expected.length, accuracy);
  }

  function shuffledPuzzle() {
    const puzzle = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let blank = 8;
    let previous = -1;
    for (let move = 0; move < 90; move += 1) {
      const row = Math.floor(blank / 3);
      const col = blank % 3;
      const candidates = [];
      if (row > 0) candidates.push(blank - 3);
      if (row < 2) candidates.push(blank + 3);
      if (col > 0) candidates.push(blank - 1);
      if (col < 2) candidates.push(blank + 1);
      const choices = candidates.filter((value) => value !== previous);
      const next = sample(choices.length ? choices : candidates);
      [puzzle[blank], puzzle[next]] = [puzzle[next], puzzle[blank]];
      previous = blank;
      blank = next;
    }
    return puzzle.join(",") === "1,2,3,4,5,6,7,8,0" ? [1,2,3,4,5,6,7,0,8] : puzzle;
  }

  function renderPuzzle() {
    const challenge = currentChallenge;
    if (!challenge.state.puzzle) challenge.state.puzzle = shuffledPuzzle();
    const data = challenge.stage.challenge;
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${localize(data.title)}</h3><p>${tr("puzzleHelp")}</p></div>
      <div class="puzzle-layout">
        <div class="sliding-puzzle">
          ${challenge.state.puzzle.map((value, index) => `<button class="puzzle-tile ${value === 0 ? "is-empty" : ""}" data-puzzle-index="${index}" ${value === 0 ? "disabled" : ""}>${value || ""}</button>`).join("")}
        </div>
        <div class="puzzle-story"><span class="big-emoji">${data.emoji}</span><h3>${localize(data.title)}</h3><p>${localize(data.fact)}</p></div>
      </div>`;
  }

  function movePuzzle(index) {
    const puzzle = currentChallenge.state.puzzle;
    const blank = puzzle.indexOf(0);
    const row = Math.floor(index / 3);
    const col = index % 3;
    const blankRow = Math.floor(blank / 3);
    const blankCol = blank % 3;
    if (Math.abs(row - blankRow) + Math.abs(col - blankCol) !== 1) return;
    [puzzle[index], puzzle[blank]] = [puzzle[blank], puzzle[index]];
    audio.click();
    if (puzzle.join(",") === "1,2,3,4,5,6,7,8,0") {
      renderPuzzle();
      resolveChallenge(true, 100, tr("puzzleSolved"));
    } else renderPuzzle();
  }

  function renderTrueFalse() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (stateData.index === undefined) {
      stateData.index = 0;
      stateData.correct = 0;
      stateData.locked = false;
    }
    const statements = challenge.stage.challenge.statements;
    const statement = statements[stateData.index];
    const hint = stateData.hintAnswer === undefined ? "" : `<div class="written-hint">${stateData.hintAnswer ? tr("trueLabel") : tr("falseLabel")}</div>`;
    $("#challengeBody").innerHTML = `
      <div class="tf-wrap">
        <div class="challenge-intro"><h3>${tr("gameTrueFalse")}</h3><p>${tr("trueFalseHelp")}</p></div>
        <div class="tf-progress">${statements.map((_, index) => `<span class="${index < stateData.index ? "is-done" : ""}"></span>`).join("")}</div>
        <div class="tf-statement">${localize(statement.text)}</div>
        ${hint}
        <div class="tf-actions">
          <button class="tf-btn tf-true" data-tf-value="true">✓ ${tr("trueLabel")}</button>
          <button class="tf-btn tf-false" data-tf-value="false">✕ ${tr("falseLabel")}</button>
        </div>
      </div>`;
  }

  function answerTrueFalse(value) {
    const challenge = currentChallenge;
    if (!challenge || challenge.type !== "trueFalse" || challenge.state.locked) return;
    const statements = challenge.stage.challenge.statements;
    const statement = statements[challenge.state.index];
    challenge.state.locked = true;
    if (value === statement.answer) challenge.state.correct += 1;
    challenge.state.index += 1;
    challenge.state.hintAnswer = undefined;
    if (challenge.state.index >= statements.length) {
      const accuracy = Math.round((challenge.state.correct / statements.length) * 100);
      challenge.state.partialAccuracy = accuracy;
      resolveChallenge(challenge.state.correct >= 3, accuracy);
    } else {
      window.setTimeout(() => {
        if (!currentChallenge) return;
        currentChallenge.state.locked = false;
        renderTrueFalse();
      }, 260);
    }
  }

  function buildWordSearch(words, size) {
    const grid = Array.from({length:size}, () => Array(size).fill(""));
    const directions = [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
    const placements = [];
    words.forEach((entry) => {
      const word = normalizeAnswer(entry.word).replace(/ /g, "").toUpperCase();
      let placed = false;
      for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
        const [dr, dc] = sample(directions);
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        const endRow = row + dr * (word.length - 1);
        const endCol = col + dc * (word.length - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        const cells = [];
        let valid = true;
        for (let index = 0; index < word.length; index += 1) {
          const r = row + dr * index;
          const c = col + dc * index;
          if (grid[r][c] && grid[r][c] !== word[index]) valid = false;
          cells.push({r,c});
        }
        if (!valid) continue;
        cells.forEach((cell, index) => { grid[cell.r][cell.c] = word[index]; });
        placements.push({word, clue:entry.clue, cells});
        placed = true;
      }
      if (!placed) throw new Error(`Unable to place word ${word}`);
    });
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    grid.forEach((row) => row.forEach((value, index) => {
      if (!value) row[index] = alphabet[Math.floor(Math.random() * alphabet.length)];
    }));
    return {grid, placements};
  }

  function renderWordSearch() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (!stateData.grid) {
      const sourceWords = challenge.stage.challenge.words[state.language];
      const built = buildWordSearch(sourceWords, challenge.stage.challenge.size);
      Object.assign(stateData, built, {found:new Set(), start:null, hintCell:null});
    }
    const size = stateData.grid.length;
    const foundCells = new Set();
    stateData.placements.filter((entry) => stateData.found.has(entry.word)).forEach((entry) => entry.cells.forEach((cell) => foundCells.add(`${cell.r}-${cell.c}`)));
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${tr("gameWordSearch")}</h3><p>${tr("wordSearchHelp")}</p></div>
      <div class="wordsearch-layout">
        <div class="word-grid" style="grid-template-columns:repeat(${size},1fr)">
          ${stateData.grid.flatMap((row, r) => row.map((letter, c) => {
            const key = `${r}-${c}`;
            const classes = [foundCells.has(key) ? "is-found" : "", stateData.start?.r === r && stateData.start?.c === c ? "is-start" : "", stateData.hintCell?.r === r && stateData.hintCell?.c === c ? "is-hint" : ""].filter(Boolean).join(" ");
            return `<button class="word-cell ${classes}" data-ws-row="${r}" data-ws-col="${c}">${letter}</button>`;
          })).join("")}
        </div>
        <div class="word-list"><h3>${tr("foundWords")}: ${stateData.found.size}/${stateData.placements.length}</h3>
          ${stateData.placements.map((entry) => `<div class="word-target ${stateData.found.has(entry.word) ? "is-found" : ""}"><b>${entry.word}</b><small>${entry.clue}</small></div>`).join("")}
        </div>
      </div>`;
  }

  function lineBetween(start, end) {
    const drRaw = end.r - start.r;
    const dcRaw = end.c - start.c;
    if (!(drRaw === 0 || dcRaw === 0 || Math.abs(drRaw) === Math.abs(dcRaw))) return [];
    const length = Math.max(Math.abs(drRaw), Math.abs(dcRaw));
    const dr = Math.sign(drRaw);
    const dc = Math.sign(dcRaw);
    return Array.from({length:length + 1}, (_, index) => ({r:start.r + dr * index, c:start.c + dc * index}));
  }

  function selectWordCell(row, col) {
    const stateData = currentChallenge.state;
    if (!stateData.start) {
      stateData.start = {r:row,c:col};
      renderWordSearch();
      return;
    }
    const cells = lineBetween(stateData.start, {r:row,c:col});
    const selected = cells.map((cell) => stateData.grid[cell.r]?.[cell.c] || "").join("");
    const reverse = [...selected].reverse().join("");
    const match = stateData.placements.find((entry) => !stateData.found.has(entry.word) && (entry.word === selected || entry.word === reverse));
    stateData.start = null;
    stateData.hintCell = null;
    if (match) {
      stateData.found.add(match.word);
      audio.correct();
      if (stateData.found.size === stateData.placements.length) {
        renderWordSearch();
        resolveChallenge(true, 100);
      } else {
        setChallengeFeedback(`${tr("answerAccepted")} ${match.word}`, "correct");
        renderWordSearch();
      }
    } else {
      setChallengeFeedback(selected ? `${tr("selectedLetters")}: ${selected}` : tr("wrongChallenge"), "wrong");
      renderWordSearch();
    }
  }

  function renderCrossword() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    const words = challenge.stage.challenge.layouts[state.language];
    const size = challenge.stage.challenge.size;
    if (!stateData.crossword) {
      const cells = new Map();
      const starts = new Map();
      words.forEach((entry, index) => {
        const startKey = `${entry.row}-${entry.col}`;
        if (!starts.has(startKey)) starts.set(startKey, index + 1);
        [...entry.word].forEach((letter, position) => {
          const row = entry.row + (entry.dir === "down" ? position : 0);
          const col = entry.col + (entry.dir === "across" ? position : 0);
          cells.set(`${row}-${col}`, letter);
        });
      });
      stateData.crossword = {cells, starts};
    }
    const {cells, starts} = stateData.crossword;
    const numberedWords = words.map((entry) => ({...entry, number: starts.get(`${entry.row}-${entry.col}`)}));
    const across = numberedWords.filter((entry) => entry.dir === "across");
    const down = numberedWords.filter((entry) => entry.dir === "down");
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${tr("gameCrossword")}</h3><p>${tr("crosswordHelp")}</p></div>
      <div class="crossword-layout">
        <div>
          <div class="crossword-grid" style="grid-template-columns:repeat(${size},1fr)">
            ${Array.from({length:size * size}, (_, flat) => {
              const row = Math.floor(flat / size); const col = flat % size; const key = `${row}-${col}`;
              if (!cells.has(key)) return `<div class="crossword-cell is-block"></div>`;
              return `<label class="crossword-cell">${starts.has(key) ? `<span class="crossword-number">${starts.get(key)}</span>` : ""}<input maxlength="1" data-cw-cell="${key}" data-expected="${cells.get(key)}" aria-label="${key}"></label>`;
            }).join("")}
          </div>
          <div class="crossword-submit"><button class="mg-primary" data-mg-submit="crossword">${tr("checkAnswer")}</button></div>
        </div>
        <div class="crossword-clues">
          <div class="clue-group"><h3>${tr("across")}</h3><ol>${across.map((entry) => `<li value="${entry.number}">${entry.clue}</li>`).join("")}</ol></div>
          <div class="clue-group"><h3>${tr("down")}</h3><ol>${down.map((entry) => `<li value="${entry.number}">${entry.clue}</li>`).join("")}</ol></div>
        </div>
      </div>`;
  }

  function submitCrossword() {
    const inputs = [...$("#challengeBody").querySelectorAll("[data-cw-cell]")];
    const filled = inputs.filter((input) => input.value.trim()).length;
    if (filled < inputs.length) {
      setChallengeFeedback(tr("incompleteChallenge"), "wrong");
      return;
    }
    const correct = inputs.filter((input) => input.value.toUpperCase() === input.dataset.expected).length;
    const accuracy = Math.round((correct / inputs.length) * 100);
    resolveChallenge(correct === inputs.length, accuracy);
  }

  function scrambleLetters(word) {
    let result = word;
    for (let attempt = 0; attempt < 10 && result === word; attempt += 1) result = shuffle([...word]).join("");
    return result === word ? [...word].reverse().join("") : result;
  }

  function renderScramble() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (stateData.index === undefined) Object.assign(stateData, {index:0,correct:0,mistakes:0,hint:"", scrambled:{}});
    const terms = challenge.stage.challenge.terms[state.language];
    const term = terms[stateData.index];
    if (!stateData.scrambled[stateData.index]) stateData.scrambled[stateData.index] = scrambleLetters(term.answer);
    $("#challengeBody").innerHTML = `
      <div class="scramble-wrap">
        <div class="challenge-intro"><h3>${tr("gameScramble")}</h3><p>${tr("scrambleHelp")}</p></div>
        <div class="scramble-count">${stateData.index + 1} / ${terms.length}</div>
        <div class="scramble-letters">${[...stateData.scrambled[stateData.index]].map((letter, index) => `<span class="scramble-letter" style="animation-delay:${index * .03}s">${letter}</span>`).join("")}</div>
        <p class="scramble-clue">💡 ${term.clue}</p>
        <form id="scrambleForm" class="mg-input-row"><input id="scrambleInput" class="mg-input" autocomplete="off" placeholder="${tr("yourAnswer")}"><button class="mg-primary" type="submit">${tr("submitAnswer")}</button></form>
        <div class="written-hint">${stateData.hint || ""}</div>
      </div>`;
    window.setTimeout(() => $("#scrambleInput")?.focus(), 30);
  }

  function submitScramble() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    const terms = challenge.stage.challenge.terms[state.language];
    const term = terms[stateData.index];
    const answer = normalizeAnswer($("#scrambleInput")?.value).replace(/ /g, "");
    if (answer === normalizeAnswer(term.answer).replace(/ /g, "")) {
      stateData.correct += 1;
      stateData.index += 1;
      stateData.hint = "";
      setChallengeFeedback(tr("answerAccepted"), "correct");
      if (stateData.index >= terms.length) resolveChallenge(true, 100);
      else renderScramble();
    } else {
      stateData.mistakes += 1;
      setChallengeFeedback(tr("wrongChallenge"), "wrong");
      if (stateData.mistakes >= 3) {
        const accuracy = Math.round((stateData.correct / terms.length) * 100);
        resolveChallenge(false, accuracy);
      }
    }
  }

  function renderMatching() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (!stateData.cards) {
      stateData.cards = shuffle(challenge.stage.challenge.pairs.flatMap((pair) => [
        {key:`${pair.id}-left`, pairId:pair.id, text:localize(pair.left)},
        {key:`${pair.id}-right`, pairId:pair.id, text:localize(pair.right)}
      ]));
      stateData.open = [];
      stateData.matched = new Set();
      stateData.locked = false;
    }
    $("#challengeBody").innerHTML = `
      <div class="challenge-intro"><h3>${tr("gameMatching")}</h3><p>${tr("matchingHelp")}</p></div>
      <div class="matching-grid">
        ${stateData.cards.map((card, index) => {
          const open = stateData.open.includes(index); const matched = stateData.matched.has(card.pairId);
          return `<button class="match-card ${open ? "is-open" : ""} ${matched ? "is-matched" : ""}" data-match-index="${index}"><span>${card.text}</span></button>`;
        }).join("")}
      </div>
      <div class="mg-status"><span>${stateData.matched.size}/${challenge.stage.challenge.pairs.length} ${tr("completed").toLowerCase()}</span></div>`;
  }

  function selectMatchCard(index) {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (stateData.locked || stateData.open.includes(index)) return;
    const card = stateData.cards[index];
    if (stateData.matched.has(card.pairId)) return;
    stateData.open.push(index);
    renderMatching();
    if (stateData.open.length < 2) return;
    stateData.locked = true;
    const [firstIndex, secondIndex] = stateData.open;
    const first = stateData.cards[firstIndex];
    const second = stateData.cards[secondIndex];
    if (first.pairId === second.pairId && first.key !== second.key) {
      stateData.matched.add(first.pairId);
      stateData.open = [];
      stateData.locked = false;
      audio.correct();
      setChallengeFeedback(tr("pairMatched"), "correct");
      renderMatching();
      if (stateData.matched.size === challenge.stage.challenge.pairs.length) resolveChallenge(true, 100);
    } else {
      setChallengeFeedback(tr("pairWrong"), "wrong");
      const cards = $$(".match-card", $("#challengeBody"));
      cards[firstIndex]?.classList.add("is-wrong");
      cards[secondIndex]?.classList.add("is-wrong");
      window.setTimeout(() => {
        if (!currentChallenge) return;
        stateData.open = [];
        stateData.locked = false;
        renderMatching();
      }, 650);
    }
  }

  function renderWritten() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    if (stateData.index === undefined) Object.assign(stateData, {index:0,correct:0,hint:""});
    const questions = challenge.stage.challenge.questions;
    const question = questions[stateData.index];
    $("#challengeBody").innerHTML = `
      <div class="written-wrap">
        <div class="challenge-intro"><h3>${tr("gameWritten")}</h3><p>${tr("writtenHelp")}</p></div>
        <div class="written-progress">${stateData.index + 1} / ${questions.length}</div>
        <div class="written-question">${localize(question.question)}</div>
        <form id="writtenForm" class="mg-input-row"><input id="writtenInput" class="mg-input" autocomplete="off" placeholder="${tr("yourAnswer")}"><button class="mg-primary" type="submit">${tr("submitAnswer")}</button></form>
        <div class="written-hint">${stateData.hint || ""}</div>
      </div>`;
    window.setTimeout(() => $("#writtenInput")?.focus(), 30);
  }

  function submitWritten() {
    const challenge = currentChallenge;
    const stateData = challenge.state;
    const questions = challenge.stage.challenge.questions;
    const question = questions[stateData.index];
    const answer = normalizeAnswer($("#writtenInput")?.value);
    const accepted = question.answers[state.language].map(normalizeAnswer);
    if (accepted.includes(answer)) {
      stateData.correct += 1;
      setChallengeFeedback(tr("answerAccepted"), "correct");
    } else setChallengeFeedback(tr("wrongChallenge"), "wrong");
    stateData.index += 1;
    stateData.hint = "";
    if (stateData.index >= questions.length) {
      const accuracy = Math.round((stateData.correct / questions.length) * 100);
      stateData.partialAccuracy = accuracy;
      resolveChallenge(stateData.correct >= 2, accuracy);
    } else renderWritten();
  }


  function showResult(result) {
    const {success, stage, score, coins, accuracy, stars} = result;
    state.progress.coins += coins;

    if (success) {
      const previous = state.progress.completed[stage.id];
      state.progress.completed[stage.id] = {
        stars: Math.max(stars, previous?.stars || 0),
        score: Math.max(score, previous?.score || 0),
        accuracy: Math.max(accuracy, previous?.accuracy || 0)
      };
      state.progress.unlockedStage = Math.max(state.progress.unlockedStage, Math.min(9, stage.id + 1));
      state.progress.xp += stars * 120 + 80;
      state.progress.totalScore += score;
      addLeaderboardScore(score, stage.id);
      audio.level();
    } else {
      state.progress.xp += Math.round(score * 0.05);
      audio.wrong();
    }

    saveState();
    const unlocked = checkAchievements({accuracy});
    $("#resultIcon").textContent = success ? "🏆" : "🧭";
    $("#resultKicker").textContent = success ? tr("missionComplete") : tr("missionFailed");
    $("#resultTitle").textContent = success ? tr("greatWork", {name: state.player.name}) : tr("keepTrying", {name: state.player.name});
    $("#resultMessage").textContent = success ? tr("completeMessage") : tr("failedMessage");
    $("#resultScore").textContent = score;
    $("#resultCoins").textContent = coins;
    $("#resultAccuracy").textContent = `${accuracy}%`;
    $("#resultStars").innerHTML = [1,2,3].map((star) => `<span class="${star <= stars ? "earned" : ""}" style="animation-delay:${star * .1}s">★</span>`).join("");

    const primary = $("#resultPrimaryBtn");
    const secondary = $("#resultSecondaryBtn");
    primary.textContent = success ? (stage.id < 9 ? tr("nextMission") : tr("backToMap")) : tr("retryMission");
    secondary.textContent = success ? tr("retry") : tr("backToMap");

    primary.onclick = () => {
      $("#resultModal").classList.add("is-hidden");
      if (success) showScreen("mapScreen");
      else startStage(stage);
    };
    secondary.onclick = () => {
      $("#resultModal").classList.add("is-hidden");
      if (success) startStage(stage);
      else showScreen("mapScreen");
    };

    $("#resultModal").classList.remove("is-hidden");
    if (unlocked.length) {
      window.setTimeout(() => toast("🎖️", tr("newBadge"), localize(unlocked[0].name)), 700);
    }
  }

  function addLeaderboardScore(score, stageId) {
    state.leaderboard.push({
      name: state.player.name || "Player",
      score,
      stageId,
      character: state.player.character,
      style: state.player.style,
      timestamp: Date.now()
    });
    state.leaderboard = state.leaderboard
      .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
      .slice(0, 20);
  }

  function checkAchievements(context = {}) {
    const completedIds = Object.keys(state.progress.completed).map(Number);
    const newIds = [];
    const award = (id) => {
      if (!state.progress.badges.includes(id)) {
        state.progress.badges.push(id);
        newIds.push(id);
      }
    };
    if (completedIds.length >= 1) award("firstRun");
    if ([1,2,3].every((id) => completedIds.includes(id))) award("iceMaster");
    if ([4,5,6].every((id) => completedIds.includes(id))) award("prehistoryMaster");
    if ([7,8,9].every((id) => completedIds.includes(id))) award("civilisationMaster");
    if (context.accuracy === 100) award("perfectRun");
    if (state.progress.coins >= 300) award("coinCollector");
    if ((state.player.stylesUsed || []).includes("cartoon") && (state.player.stylesUsed || []).includes("explorer")) award("allStyles");
    if (completedIds.length === 9) award("historyLegend");
    if (newIds.length) saveState();
    return DATA.achievements.filter((achievement) => newIds.includes(achievement.id));
  }

  function leaderboardEntries() {
    const bestByName = new Map();
    state.leaderboard.forEach((entry) => {
      const key = `${entry.name}`.toLowerCase();
      if (!bestByName.has(key) || bestByName.get(key).score < entry.score) bestByName.set(key, entry);
    });
    return [...bestByName.values()].sort((a,b) => b.score - a.score).slice(0,10);
  }

  function renderLeaderboard() {
    const entries = leaderboardEntries();
    const podium = $("#podium");
    const list = $("#rankingList");
    if (!podium || !list) return;
    const top = entries.slice(0,3);
    podium.innerHTML = top.map((entry, index) => `
      <div class="podium-card">
        <img class="podium-avatar" src="${characterAsset(entry.style, entry.character)}" alt="" />
        <span class="podium-rank">${["🥈","🥇","🥉"][index]}</span>
        <strong>${entry.name}</strong>
        <small>${DATA.characters.find((c)=>c.id===entry.character)?.role[state.language] || ""}</small>
        <div class="podium-score">${entry.score.toLocaleString()} pts</div>
      </div>`).join("");

    list.innerHTML = entries.map((entry, index) => `
      <div class="ranking-row ${entry.name === state.player.name ? "is-player" : ""}">
        <b>#${index + 1}</b>
        <div><strong>${entry.name}</strong><small>${entry.style === "cartoon" ? tr("styleCartoon") : tr("styleExplorer")}</small></div>
        <span class="ranking-score">${entry.score.toLocaleString()}</span>
      </div>`).join("") || `<p>${tr("rankingEmpty")}</p>`;
  }

  function renderAchievements() {
    const unlocked = new Set(state.progress.badges);
    $("#achievementSummary").innerHTML = `
      <div class="summary-pill">⭐ <b>${state.progress.totalScore.toLocaleString()}</b> ${tr("totalScore")}</div>
      <div class="summary-pill">🗺️ <b>${Object.keys(state.progress.completed).length}/9</b> ${tr("missionsComplete")}</div>
      <div class="summary-pill">🎖️ <b>${unlocked.size}/${DATA.achievements.length}</b> ${tr("badgesCollected")}</div>`;
    $("#achievementGrid").innerHTML = DATA.achievements.map((achievement) => {
      const isUnlocked = unlocked.has(achievement.id);
      return `
        <article class="achievement-card ${isUnlocked ? "is-unlocked" : "is-locked"}">
          <span class="badge-state">${isUnlocked ? tr("unlocked") : tr("hidden")}</span>
          <span class="badge-icon">${isUnlocked ? achievement.icon : "🔒"}</span>
          <h3>${localize(achievement.name)}</h3>
          <p>${localize(achievement.desc)}</p>
        </article>`;
    }).join("");
  }

  function syncSettings() {
    $("#soundToggle").checked = state.sound;
    $("#musicToggle").checked = state.music;
    $("#motionToggle").checked = state.reduceMotion;
    $("#volumeRange").value = Math.round(state.volume * 100);
    $("#volumeValue").textContent = Math.round(state.volume * 100);
    document.body.classList.toggle("reduce-motion", state.reduceMotion);
    $$(".segmented [data-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.language === state.language));
  }

  function openConfirm(title, message, callback) {
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    confirmCallback = callback;
    $("#confirmModal").classList.remove("is-hidden");
  }

  function closeConfirm() {
    $("#confirmModal").classList.add("is-hidden");
    confirmCallback = null;
  }

  function resetProgress() {
    const preserved = {
      language: state.language,
      sound: state.sound,
      music: state.music,
      volume: state.volume,
      reduceMotion: state.reduceMotion,
      player: {...state.player}
    };
    state = {...defaultState(), ...preserved};
    saveState();
    updateTranslations();
    toast("↺", tr("progressReset"));
    closeConfirm();
    showScreen("homeScreen");
  }

  function pauseGame() {
    if (!runner) return;
    runner.pause(true);
    $("#pauseOverlay").classList.remove("is-hidden");
  }

  function resumeGame() {
    $("#pauseOverlay").classList.add("is-hidden");
    runner?.pause(false);
  }

  function quitGame() {
    openConfirm(tr("quitTitle"), tr("quitMessage"), () => {
      runner?.destroy();
      runner = null;
      $("#pauseOverlay").classList.add("is-hidden");
      closeConfirm();
      showScreen("mapScreen");
    });
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) navigate(actionButton.dataset.action);

      const languageButton = event.target.closest("[data-language]");
      if (languageButton) setLanguage(languageButton.dataset.language);

      const styleButton = event.target.closest("[data-style]");
      if (styleButton) {
        previewStyle = styleButton.dataset.style;
        audio.click();
        renderCharacterCarousel();
      }

      const characterCard = event.target.closest("[data-character-index]");
      if (characterCard) {
        carouselIndex = Number(characterCard.dataset.characterIndex);
        audio.click();
        renderCharacterCarousel();
      }

      const stageButton = event.target.closest("[data-stage-id]");
      if (stageButton) startStage(stageById(stageButton.dataset.stageId));

      const mgAnswer = event.target.closest("[data-mg-answer]");
      if (mgAnswer && !mgAnswer.classList.contains("is-disabled")) handleMCQAnswer(Number(mgAnswer.dataset.mgAnswer));

      const timelineMove = event.target.closest("[data-timeline-move]");
      if (timelineMove) moveTimeline(Number(timelineMove.dataset.index), Number(timelineMove.dataset.timelineMove));

      const miniSubmit = event.target.closest("[data-mg-submit]");
      if (miniSubmit?.dataset.mgSubmit === "timeline") submitTimeline();
      if (miniSubmit?.dataset.mgSubmit === "crossword") submitCrossword();

      const puzzleTile = event.target.closest("[data-puzzle-index]");
      if (puzzleTile) movePuzzle(Number(puzzleTile.dataset.puzzleIndex));

      const tfButton = event.target.closest("[data-tf-value]");
      if (tfButton) answerTrueFalse(tfButton.dataset.tfValue === "true");

      const wordCell = event.target.closest("[data-ws-row]");
      if (wordCell) selectWordCell(Number(wordCell.dataset.wsRow), Number(wordCell.dataset.wsCol));

      const matchCard = event.target.closest("[data-match-index]");
      if (matchCard) selectMatchCard(Number(matchCard.dataset.matchIndex));

      const control = event.target.closest("[data-runner-control]");
      if (control) runner?.control(control.dataset.runnerControl);
    });

    document.addEventListener("submit", (event) => {
      if (event.target.id === "scrambleForm") {
        event.preventDefault();
        submitScramble();
      }
      if (event.target.id === "writtenForm") {
        event.preventDefault();
        submitWritten();
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches("[data-cw-cell]")) {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
      }
    });

    $("#profileForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#playerNameInput").value.trim();
      if (!name) {
        toast("✍️", tr("noName"));
        return;
      }
      state.player.name = name;
      saveState();
      toast("🧭", tr("profileSaved"), name);
      showScreen("characterScreen");
    });

    $("#playerNameInput").addEventListener("input", (event) => {
      $("#profilePreviewName").textContent = event.target.value.trim() || tr("defaultPlayerName");
    });

    $("#characterNameInput").addEventListener("input", (event) => {
      const liveName = event.target.value.trim() || tr("defaultPlayerName");
      $("#profilePreviewName").textContent = liveName;
    });

    $("#characterPrev").addEventListener("click", () => moveCarousel(-1));
    $("#characterNext").addEventListener("click", () => moveCarousel(1));
    $("#selectCharacterBtn").addEventListener("click", selectCharacter);
    $("#hintBtn").addEventListener("click", useHint);
    $("#pauseBtn").addEventListener("click", pauseGame);
    $("#resumeBtn").addEventListener("click", resumeGame);
    $("#quitRunBtn").addEventListener("click", quitGame);

    $("#soundToggle").addEventListener("change", (event) => {
      state.sound = event.target.checked;
      saveState();
      if (state.sound) audio.click();
      toast("🔊", state.sound ? tr("soundOn") : tr("soundOff"));
    });
    $("#musicToggle").addEventListener("change", (event) => {
      state.music = event.target.checked;
      saveState();
      if (state.music) {
        audio.startMusic();
        toast("🎵", tr("musicOn"));
      } else {
        audio.stopMusic();
        toast("🔇", tr("musicOff"));
      }
    });
    $("#volumeRange").addEventListener("input", (event) => {
      state.volume = Number(event.target.value) / 100;
      $("#volumeValue").textContent = event.target.value;
      audio.setVolume();
      saveState();
    });
    $("#motionToggle").addEventListener("change", (event) => {
      state.reduceMotion = event.target.checked;
      document.body.classList.toggle("reduce-motion", state.reduceMotion);
      saveState();
    });
    $("#resetProgressBtn").addEventListener("click", () => openConfirm(tr("resetTitle"), tr("resetMessage"), resetProgress));
    $("#confirmCancel").addEventListener("click", closeConfirm);
    $("#confirmAccept").addEventListener("click", () => confirmCallback?.());

    window.addEventListener("pointerdown", () => {
      audio.ensure();
      if (state.music && currentScreen !== "runnerScreen") audio.startMusic();
    }, {once: true});

    window.addEventListener("beforeunload", () => runner?.destroy());
  }

  function init() {
    registerEvents();
    updateTranslations();
    updateResources();
    syncSettings();
    $("#playerNameInput").value = state.player.name;
    $("#profilePreviewName").textContent = state.player.name || tr("defaultPlayerName");
    const characterNameInput = $("#characterNameInput");
    if (characterNameInput && document.activeElement !== characterNameInput) characterNameInput.value = state.player.name || "";

    window.setTimeout(() => {
      showScreen("homeScreen");
    }, 1550);

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch((error) => console.warn("Service worker:", error));
    }
  }

  init();
})();
