const axios = require("axios");
const { ensureDbEntities } = require("../nexus-core/dbSync"); // Correct path

const activeSessions = new Map();

module.exports = {
  config: {
    name: "gagstock",
    shortDescription: "Track Grow A Garden stock including cosmetics and restocks",
    guide: "{prefix}gagstock <on | off>",
    role: 0 // Accessible to everyone
  },

  run: async function ({ api, event }) {
    // Ensure user exists in the database
    try {
      await ensureDbEntities(api, event);
    } catch (error) {
      console.error(`❌ Failed to sync database for user ${event.senderID}:`, error.message);
      api.sendMessage("⚠️ 𝗘𝗿𝗿𝗼𝗿 𝗶𝗻𝗶𝘁𝗶𝗮𝗹𝗶𝘇𝗶𝗻𝗴 𝗱𝗮𝘁𝗮𝗯𝗮𝘀𝗲. 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗺𝗮𝘆 𝘀𝘁𝗶𝗹𝗹 𝘄𝗼𝗿𝗸.", event.threadID);
    }

    const action = event.body.split(" ")[1]?.toLowerCase();
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (action === "off") {
      const session = activeSessions.get(senderID);
      if (session) {
        clearInterval(session.interval);
        activeSessions.delete(senderID);
        return api.sendMessage("🛑 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗦𝘁𝗼𝗽𝗽𝗲𝗱 🌱", threadID);
      } else {
        return api.sendMessage("⚠️ 𝗡𝗼 𝗔𝗰𝘁𝗶𝘃𝗲 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗦𝗲𝘀𝘀𝗶𝗼𝗻 𝗙𝗼𝘂𝗻𝗱", threadID);
      }
    }

    if (action !== "on") {
      return api.sendMessage(
        "📌 𝗨𝘀𝗮𝗴𝗲 𝗚𝘂𝗶𝗱𝗲\n" +
        "➤ `{prefix}gagstock on` 𝘁𝗼 𝘀𝘁𝗮𝗿𝘁 𝘁𝗿𝗮𝗰𝗸𝗶𝗻𝗴\n" +
        "➤ `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽 𝘁𝗿𝗮𝗰𝗸𝗶𝗻𝗴",
        threadID
      );
    }

    if (activeSessions.has(senderID)) {
      return api.sendMessage(
        "📡 𝗔𝗹𝗿𝗲𝗮𝗱𝘆 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸! 𝗨𝘀𝗲 `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽.",
        threadID
      );
    }

    api.sendMessage(
      "✅ �_G𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗦𝘁𝗮𝗿𝘁𝗲𝗱! 🌟 𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻𝘀 𝗳𝗼𝗿 𝘀𝘁𝗼𝗰𝗸, 𝘄𝗲𝗮𝘁𝗵𝗲𝗿, 𝗮𝗻𝗱 𝗰𝗼𝘀𝗺𝗲𝘁𝗶𝗰 𝘂𝗽𝗱𝗮𝘁𝗲𝘀.",
      threadID
    );

    const convertTime = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
    };

    const getHoneyRestockCountdown = () => {
      const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const currentMinutes = nowPH.getMinutes();
      const currentSeconds = nowPH.getSeconds();
      const remainingMinutes = 59 - currentMinutes;
      const remainingSeconds = 60 - currentSeconds;
      const totalSeconds = remainingMinutes * 60 + remainingSeconds;
      return convertTime(totalSeconds * 1000);
    };

    const normalizeString = (str) => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const sessionData = {
      interval: null,
      lastCombinedKey: null,
      lastMessage: "",
    };

    const fetchAll = async () => {
      try {
        const [
          gearSeedRes,
          eggRes,
          weatherRes,
          honeyRes,
          cosmeticsRes,
          seedsEmojiRes,
        ] = await Promise.all([
          axios.get("https://growagardenstock.com/api/stock?type=gear-seeds"),
          axios.get("https://growagardenstock.com/api/stock?type=egg"),
          axios.get("https://growagardenstock.com/api/stock/weather"),
          axios.get("http://65.108.103.151:22377/api/stocks?type=honeyStock"),
          axios.get("https://growagardenstock.com/api/special-stock?type=cosmetics"),
          axios.get("http://65.108.103.151:22377/api/stocks?type=seedsStock"),
        ]);

        const gearSeed = gearSeedRes.data;
        const egg = eggRes.data;
        const weather = weatherRes.data;
        const honey = honeyRes.data;
        const cosmetics = cosmeticsRes.data;
        const emojiSeeds = honeyRes.data?.seedsStock || [];

        const combinedKey = JSON.stringify({
          gear: gearSeed.gear,
          seeds: gearSeed.seeds,
          egg: egg.egg,
          weather: weather.updatedAt,
          honeyStock: honey.honeyStock,
          cosmetics: cosmetics.cosmetics,
        });

        if (combinedKey === sessionData.lastCombinedKey) return;
        sessionData.lastCombinedKey = combinedKey;

        const gearRestock = convertTime((300 - Math.floor((Date.now() - gearSeed.updatedAt) / 1000)) * 1000);
        const eggRestock = convertTime((600 - Math.floor((Date.now() - egg.updatedAt) / 1000)) * 1000);
        const cosmeticsRestock = convertTime((14400 - Math.floor((Date.now() - cosmetics.updatedAt) / 1000)) * 1000);
        const honeyRestock = getHoneyRestockCountdown();

        const gearList = gearSeed.gear?.map((item) => `  ➤ ${item}`).join("\n") || "  ➤ No gear available";
        const seedList = gearSeed.seeds?.map((seed) => {
          const name = seed.split(" **")[0];
          const matched = emojiSeeds.find((s) => normalizeString(s.name) === normalizeString(name));
          const emoji = matched?.emoji || "";
          return `  ➤ ${emoji ? `${emoji} ` : ""}${seed}`;
        }).join("\n") || "  ➤ No seeds available";
        const eggList = egg.egg?.map((item) => `  ➤ ${item}`).join("\n") || "  ➤ No eggs available";
        const cosmeticsList = cosmetics.cosmetics?.map((item) => `  ➤ ${item}`).join("\n") || "  ➤ No cosmetics available";
        const honeyList = honey.honeyStock?.map((h) => `  ➤ ${h.name}: ${h.value}`).join("\n") || "  ➤ No honey stock available";

        const weatherIcon = weather.icon || "🌦️";
        const weatherCurrent = weather.currentWeather || "Unknown";
        const cropBonus = weather.cropBonuses || "None";
        const weatherText = `${weatherIcon} ${weatherCurrent}`;

        const message =
          `🌿 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 𝗧𝗿𝗮𝗰𝗸𝗲𝗿 🌿\n` +
          `═══════════════════════\n\n` +
          `🛠️ 𝗚𝗲𝗮𝗿\n${gearList}\n\n` +
          `🌱 𝗦𝗲𝗲𝗱𝘀\n${seedList}\n\n` +
          `🥚 𝗘𝗴𝗴𝘀\n${eggList}\n\n` +
          `🎨 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀\n${cosmeticsList}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${cosmeticsRestock}\n\n` +
          `🍯 �_H𝗼𝗻𝗲𝘆 𝗦𝘁𝗼𝗰𝗸\n${honeyList}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${honeyRestock}\n\n` +
          `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿\n${weatherText}\n🪴 𝗖𝗿𝗼𝗽 𝗕𝗼𝗻𝘂𝘀: ${cropBonus}\n\n` +
          `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${gearRestock}\n` +
          `📅 𝗘𝗴𝗴 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${eggRestock}\n` +
          `═══════════════════════`;

        if (message !== sessionData.lastMessage) {
          sessionData.lastMessage = message;
          api.sendMessage(message, threadID);
        }
      } catch (err) {
        console.error(`❌ Gagstock error for ${senderID}:`, err.message);
      }
    };

    sessionData.interval = setInterval(fetchAll, 10 * 1000);
    activeSessions.set(senderID, sessionData);
    await fetchAll();
  },
};
