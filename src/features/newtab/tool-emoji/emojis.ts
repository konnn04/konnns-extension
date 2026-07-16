export interface EmojiCategory {
  id: string;
  icon: string;
  emojis: string[];
}

/** Curated emoji set grouped by category (copy-to-clipboard picker). */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    icon: "😀",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠".split(" "),
  },
  {
    id: "gestures",
    icon: "👍",
    emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 💪 🦾 ✍️ 🤳".split(" "),
  },
  {
    id: "hearts",
    icon: "❤️",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💋 🌹 🥀".split(" "),
  },
  {
    id: "animals",
    icon: "🐶",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🐋 🦈".split(" "),
  },
  {
    id: "food",
    icon: "🍔",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🌽 🥕 🍞 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍜 🍲 🍣 🍱 🍚 🍦 🍰 🎂 🍫 🍿 🍩 🍪 ☕ 🍵 🧋 🍺".split(" "),
  },
  {
    id: "activity",
    icon: "⚽",
    emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 ⛳ 🎣 🥊 🎮 🎲 🎯 🎳 🎸 🎹 🥁 🎺 🎻 🎤 🎧 🎬 🏆 🥇 🥈 🥉 🚴 🏃 🧗 🏊 🚀".split(" "),
  },
  {
    id: "objects",
    icon: "💡",
    emojis: "💡 🔦 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📷 🎥 🔋 🔌 📎 ✂️ 📌 📍 🗓️ 📅 📆 📖 📚 ✏️ 🖊️ 🖌️ 🎨 🔍 🔑 🔒 🔓 🔔 🎁 🎈 🎉 🧭 ⏰ ⏳".split(" "),
  },
  {
    id: "symbols",
    icon: "⭐",
    emojis: "⭐ 🌟 ✨ ⚡ 🔥 💥 ☀️ 🌈 ☁️ ❄️ 💧 🌊 ✅ ❌ ❗ ❓ 💯 ♻️ ⚠️ 🚫 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🏳️ 🏴 🚩 🎯 💫 🕐".split(" "),
  },
];
