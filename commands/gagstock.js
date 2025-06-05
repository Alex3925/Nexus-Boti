const axios = require("axios");

const activeSessions = new Map();

module.exports = {
  config: {
    name: "gagstock",
    shortDescription: "Track Grow A Garden stock including cosmetics and restocks",
    guide: "{prefix}gagstock <on | off>",
    role: 0 // Accessible to everyone
  },

  run: async function ({ api, event, utils }) {
    // Ensure user and thread exist in the database
    await utils.ensureDbEntities(api, event);

    const action = event.body.split(" ")[1]?.toLowerCase();
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (action === "off") {
      const session = activeSessions.get(senderID);
      if (session) {
        clearInterval(session.interval);
        activeSessions.delete(senderID);
        return api.sendMessage("🛑 Gagstock tracking stopped.", threadID);
      } else {
        return api.sendMessage("⚠️ You don't have an active gagstock session.", threadID);
      }
    }

    if (action !== "on") {
      return api.sendMessage(
        "📌 Usage:\n• `{prefix}gagstock on` to start tracking\n• `{prefix}gagstock off` to stop tracking",
        threadID
      );
    }

    if (activeSessions.has(senderID)) {
      return api.sendMessage(
        "📡 You're already tracking Gagstock. Use `{prefix}gagstock off` to stop.",
        threadID
      );
    }

    api.sendMessage(
      "✅ Gagstock tracking started! You'll be notified when stock, weather, or cosmetics change.",
      threadID
    );

    const getHoneyRestockCountdown = () => {
      const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const currentMinutes = nowPH.getMinutes();
      const currentSeconds = nowPH.getSeconds();
      const remainingMinutes = 59 - currentMinutes;
      const remainingSeconds = 60 - currentSeconds;
      const totalSeconds = remainingMinutes * 60 + remainingSeconds;
      return utils.convertTime(totalSeconds * 1000); // Use Nexus Bot's convertTime utility
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

        const gearRestock = utils.convertTime((300 - Math.floor((Date.now() - gearSeed.updatedAt) / 1000)) * 1000);
        const eggRestock = utils.convertTime((600 - Math.floor((Date.now() - egg.updatedAt) / 1000)) * 1000);
        const cosmeticsRestock = utils.convertTime((14400 - Math.floor((Date.now() - cosmetics.updatedAt) / 1000)) * 1000);
        const honeyRestock = getHoneyRestockCountdown();

        const gearList = gearSeed.gear?.map((item) => `- ${item}`).join("\n") || "No gear.";
        const seedList = gearSeed.seeds?.map((seed) => {
          const name = seed.split(" **")[0];
          const matched = emojiSeeds.find((s) => utils.normalizeString(s.name) === utils.normalizeString(name));
          const emoji = matched?.emoji || "";
          return `- ${emoji ? `${emoji} ` : ""}${seed}`;
        }).join("\n") || "No seeds.";
        const eggList = egg.egg?.map((item) => `- ${item}`).join("\n") || "No eggs.";
        const cosmeticsList = cosmetics.cosmetics?.map((item) => `- ${item}`).join("\n") || "No cosmetics.";
        const honeyList = honey.honeyStock?.map((h) => `- ${h.name}: ${h.value}`).join("\n") || "No honey stock.";

        const weatherIcon = weather.icon || "🌦️";
        const weatherCurrent = weather.currentWeather || "Unknown";
        const cropBonus = weather.cropBonuses || "None";
        const weatherText = `${weatherIcon} ${weatherCurrent}`;

        const message = `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗧𝗿𝗮𝗰𝗸𝗲𝗿\n\n` +
          `🛠️ 𝗚𝗲𝗮𝗿:\n${gearList}\n\n` +
          `🌱 𝗦𝗲𝗲𝗱𝘀:\n${seedList}\n\n` +
          `🥚 𝗘𝗴𝗴𝘀:\n${eggList}\n\n` +
          `🎨 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀:\n${cosmeticsList}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸 𝗶𝗻: ${cosmeticsRestock}\n\n` +
          `🍯 𝗛𝗼𝗻𝗲𝘆 𝗦𝘁𝗼𝗰𝗸:\n${honeyList}\n⏳ �_R𝗲𝘀𝘁𝗼𝗰𝗸 𝗶𝗻: ${honeyRestock}\n\n` +
          `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherText}\n🪴 𝗖𝗿𝗼𝗽 𝗕𝗼𝗻𝘂𝘀: ${cropBonus}\n\n` +
          `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗿𝗲𝘀𝘁𝗼𝗰𝗸 �𝗶𝗻: ${gearRestock}\n` +
          `📅 𝗘𝗴𝗴 𝗿𝗲𝘀𝘁𝗼𝗰𝗸 ��_i𝗻: ${eggRestock}`;

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
