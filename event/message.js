import config from "../config.js"
import Func from "../lib/function.js"

import fs from "fs"
import chalk from "chalk"
import axios from "axios"
import path from "path"
import { getBinaryNodeChildren } from "@whiskeysockets/baileys"
import { exec } from "child_process"
import { format } from "util"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const __filename = Func.__filename(import.meta.url)
const require = createRequire(import.meta.url)

export default async function Message(hisoka, m, chatUpdate) {
    try {
        if (!m) return
        if (!config.options.public && !m.isOwner) return
        if (m.from && db.groups[m.from]?.mute && !m.isOwner) return
        if (m.isBaileys) return

        (await import("../lib/loadDatabase.js")).default(m)

        const prefix = m.prefix
        const isCmd = m.body.startsWith(prefix)
        const command = isCmd ? m.command.toLowerCase() : ""
        const quoted = m.isQuoted ? m.quoted : m

        // LOG Chat
        if (m.message && !m.isBaileys) {
            console.log(chalk.black(chalk.bgWhite("- FROM")), chalk.black(chalk.bgGreen(m.pushName)), chalk.black(chalk.yellow(m.sender)) + "\n" + chalk.black(chalk.bgWhite("- IN")), chalk.black(chalk.bgGreen(m.isGroup ? m.metadata.subject : "Private Chat", m.from)) + "\n" + chalk.black(chalk.bgWhite("- MESSAGE")), chalk.black(chalk.bgGreen(m.body || m.type)))
        }

        switch (command) {

            /* for main menu  */
            case "menu": case "help": {
                let text = `Hi @${m.sender.split`@`[0]}, This is a list of available commands\n\n*Total Command :* ${Object.values(config.menu).map(a => a.length).reduce((total, num) => total + num, 0)}\n\n`

                Object.entries(config.menu).map(([type, command]) => {
                    text += `┌──⭓ *${Func.toUpper(type)}*\n`
                    text += `│\n`
                    text += `│⎚ ${command.map(a => `${prefix + a}`).join("\n│⎚ ")}\n`
                    text += `│\n`
                    text += `└───────⭓\n\n`
                }).join('\n\n')

                return hisoka.sendMessage(m.from, {
                    text, contextInfo: {
                        mentionedJid: hisoka.parseMention(text),
                        externalAdReply: {
                            title: hisoka?.user?.name,
                            mediaType: 1,
                            previewType: 0,
                            renderLargerThumbnail: true,
                            thumbnail: fs.readFileSync("./temp/hisoka.jpg"),
                            sourceUrl: config.Exif.packWebsite
                        }
                    }
                }, { quoted: m })
            }
            break
            break
            case "owner": {
                hisoka.sendContact(m.from, config.options.owner, m)
            }
            break
            case "ping": {
                const moment = (await import("moment-timezone")).default
                const calculatePing = function (timestamp, now) {
                    return moment.duration(now - moment(timestamp * 1000)).asSeconds();
                }
                m.reply(`*Ping :* *_${calculatePing(m.timestamp, Date.now())} second(s)_*`)
            }
            break

            /* for owner menu  */
            case "public": {
                if (!m.isOwner) return m.reply("owner")
                if (config.options.public) {
                    config.options.public = false
                    m.reply('Switch Bot To Self Mode')
                } else {
                    config.options.public = true
                    m.reply('Switch Bot To Public Mode')
                }
            }
            break
            case "mute": {
                if (!m.isOwner) return m.reply("owner")
                let db = global.db.groups[m.from]
                if (db.mute) {
                    db.mute = false
                    m.reply("Succes Unmute This Group")
                } else if (!db.mute) {
                    db.mute = true
                    m.reply("Succes Mute This Group")
                }
            }
            break
            case "setpp": case "setprofile": case "seticon": {
                const media = await quoted.download()
                if (m.isOwner && !m.isGroup) {
                    if (/full/i.test(m.text)) await hisoka.setProfilePicture(hisoka?.user?.id, media, "full")
                    else if (/(de(l)?(ete)?|remove)/i.test(m.text)) await hisoka.removeProfilePicture(hisoka.decodeJid(hisoka?.user?.id))
                    else await hisoka.setProfilePicture(hisoka?.user?.id, media, "normal")
                } else if (m.isGroup && m.isAdmin && m.isBotAdmin) {
                    if (/full/i.test(m.text)) await hisoka.setProfilePicture(m.from, media, "full")
                    else if (/(de(l)?(ete)?|remove)/i.test(m.text)) await hisoka.removeProfilePicture(m.from)
                    else await hisoka.setProfilePicture(m.from, media, "normal")
                }
            }
            break
            case "setname": {
                if (m.isOwner && !m.isGroup) {
                    await hisoka.updateProfileName(m.isQuoted ? quoted.body : quoted.text)
                } else if (m.isGroup && m.isAdmin && m.isBotAdmin) {
                    await hisoka.groupUpdateSubject(m.from, m.isQuoted ? quoted.body : quoted.text)
                }
            }
            break

            /* for convert menu  */
            case "sticker": case "s": case "stiker": {
                if (/image|video|webp/i.test(quoted.mime)) {
                    m.reply("wait")
                    const buffer = await quoted.download()
                    if (quoted?.msg?.seconds > 10) return m.reply(`Max video 9 second`)
                    let exif
                    if (m.text) {
                        let [packname, author] = m.text.split("|")
                        exif = { packName: packname ? packname : "", packPublish: author ? author : "" }
                    } else {
                        exif = { ...config.Exif }
                    }
                    m.reply(buffer, { asSticker: true, ...exif })
                } else if (m.mentions[0]) {
                    m.reply("wait")
                    let url = await hisoka.profilePictureUrl(m.mentions[0], "image");
                    m.reply(url, { asSticker: true, ...config.Exif })
                } else if (/(https?:\/\/.*\.(?:png|jpg|jpeg|webp|mov|mp4|webm|gif))/i.test(m.text)) {
                    m.reply("wait")
                    m.reply(Func.isUrl(m.text)[0], { asSticker: true, ...config.Exif })
                } else {
                    m.reply(`Method Not Support`)
                }
            }
            break
            case "toimg": case "toimage": {
                let { webp2mp4File } = (await import("../lib/sticker.js"))
                if (!/webp/i.test(quoted.mime)) return m.reply(`Reply Sticker with command ${prefix + command}`)
                if (quoted.isAnimated) {
                    let media = await webp2mp4File((await quoted.download()))
                    await m.reply(media)
                }
                let media = await quoted.download()
                await m.reply(media, { mimetype: "image/png" })
            }
            break

            /* for group menu  */
            case "hidetag": case "ht": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                let mentions = m.metadata.participants.map(a => a.id)
                let mod = await hisoka.cMod(m.from, quoted, /hidetag|tag|ht|h|totag/i.test(quoted.body.toLowerCase()) ? quoted.body.toLowerCase().replace(prefix + command, "") : quoted.body)
                hisoka.sendMessage(m.from, { forward: mod, mentions })
            }
            break
            case "tagall": case "tag": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                let text  = `┌──⭓ *Tag all*\n`
                    text += `│\n`
                for (let mem of m.metadata.participants) {
                    text += `│⎚ @${mem.id.split('@')[0]}\n`
                }
                    text += `│\n`
                    text += `└───────⭓\n`

                    return hisoka.sendMessage(m.from, {
                        text, contextInfo: {
                            mentionedJid: hisoka.parseMention(text),
                            externalAdReply: {
                                title: hisoka?.user?.name,
                                mediaType: 1,
                                previewType: 0,
                                renderLargerThumbnail: true,
                                thumbnail: fs.readFileSync("./temp/hisoka.jpg"),
                                sourceUrl: config.Exif.packWebsite
                            }
                        }
                    }, { quoted: m })
            }
            break
            case "add": case "+": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                if (!m.isBotAdmin) return m.reply("botAdmin")
                let users = m.mentions.length !== 0 ? m.mentions.slice(0, 2) : m.isQuoted ? [m.quoted.sender] : m.text.split(",").map(v => v.replace(/[^0-9]/g, '') + "@s.whatsapp.net").slice(0, 2)
                if (users.length == 0) return m.reply('Fuck You 🖕')
                await hisoka.groupParticipantsUpdate(m.from, users, "add")
                    .then(async (res) => {
                        for (let i of res) {
                            if (i.status == 403) {
                                let node = getBinaryNodeChildren(i.content, "add_request")
                                await m.reply(`Can't add @${i.jid.split('@')[0]}, send invitation...`)
                                let url = await hisoka.profilePictureUrl(m.from, "image").catch(_ => "https://lh3.googleusercontent.com/proxy/esjjzRYoXlhgNYXqU8Gf_3lu6V-eONTnymkLzdwQ6F6z0MWAqIwIpqgq_lk4caRIZF_0Uqb5U8NWNrJcaeTuCjp7xZlpL48JDx-qzAXSTh00AVVqBoT7MJ0259pik9mnQ1LldFLfHZUGDGY=w1200-h630-p-k-no-nu")
                                await hisoka.sendGroupV4Invite(i.jid, m.from, node[0]?.attrs?.code || node.attrs.code, node[0]?.attrs?.expiration || node.attrs.expiration, m.metadata.subject, url, "Invitation to join my WhatsApp Group")
                            }
                            else if (i.status == 409) return m.reply(`@${i.jid?.split('@')[0]} already in this group`)
                            else m.reply(Func.format(i))
                        }
                    })
            }
            break
            case "kick": case "remove": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                if (!m.isBotAdmin) return m.reply("botAdmin")
                let users = m.mentions.length !== 0 ? m.mentions.slice(0, 2) : m.isQuoted ? [m.quoted.sender] : m.text.split(",").map(v => v.replace(/[^0-9]/g, '') + "@s.whatsapp.net").slice(0, 2)
                if (users.length == 0) return m.reply('Fuck You 🖕')
                await hisoka.groupParticipantsUpdate(m.from, users, "remove")
            }
            break
            case "promote": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                if (!m.isBotAdmin) return m.reply("botAdmin")
                let users = m.mentions.length !== 0 ? m.mentions.slice(0, 2) : m.isQuoted ? [m.quoted.sender] : m.text.split(",").map(v => v.replace(/[^0-9]/g, '') + "@s.whatsapp.net").slice(0, 2)
                if (users.length == 0) return m.reply('Fuck You 🖕')
                await hisoka.groupParticipantsUpdate(m.from, users, "promote")
            }
            break
            case "demote": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                if (!m.isBotAdmin) return m.reply("botAdmin")
                let users = m.mentions.length !== 0 ? m.mentions.slice(0, 2) : m.isQuoted ? [m.quoted.sender] : m.text.split(",").map(v => v.replace(/[^0-9]/g, '') + "@s.whatsapp.net").slice(0, 2)
                if (users.length == 0) return m.reply('Fuck You 🖕')
                await hisoka.groupParticipantsUpdate(m.from, users, "demote")
            }
            break
            case "welcome": {
                if (!m.isAdmin) return m.reply("admin")
                let db = global.db.groups[m.from]
                if (db.welcome) {
                    db.welcome = false
                    m.reply("Succes Deactive Welcome on This Group")
                } else if (!db.welcome) {
                    db.welcome = true
                    m.reply("Succes Activated Welcome on This Group")
                }
            }
            break
            case "leaving": {
                if (!m.isAdmin) return m.reply("admin")
                let db = global.db.groups[m.from]
                if (db.leave) {
                    db.leave = false
                    m.reply("Succes Deactive Leaving on This Group")
                } else if (!db.leave) {
                    db.leave = true
                    m.reply("Succes Activated Leaving on This Group")
                }
            }
            break
            case "linkgroup": case "linkgrup": case "linkgc": case "link": {
                if (!m.isGroup) return m.reply("group")
                if (!m.isAdmin) return m.reply("admin")
                if (!m.isBotAdmin) return m.reply("botAdmin")
                await m.reply("https://chat.whatsapp.com/" + (await hisoka.groupInviteCode(m.from)))
            }
            break
            case "join": {
                const code = m.text.replace('https://chat.whatsapp.com/','')
                if (!m.isOwner) return m.reply("owner")
                if (m.isGroup) return m.reply("private")
                (await hisoka.groupAcceptInvite(code)) ? m.reply("done!") : m.reply("urlInvalid")
            }
            break
            case "leave": case "left": case "out": {
                if (m.isOwner && m.isGroup) {
                    await m.reply("keluar dari grup...")
                    await hisoka.groupLeave(m.from)
                }
            }
            break

            /* for tool menu  */
            case "ssweb": case "ssphone": case "sstab": case "sspdf": {
                if (!m.text) return m.reply(`Cara makenya gini cuy,\ncontoh: ${prefix + command} zetcoder.my.id`)
                await m.reply("wait")
                let req = await (await api("vhyt")).get(`/tools/${command}`, { url: m.text }, { responseType: "arraybuffer" })
                try { await m.reply(req) }
                catch { await m.reply("notFound") }
            }
            break
            // view once so easy bro 🤣
            case "rvo": {
                if (!quoted.msg.viewOnce) return m.reply(`Reply view once with command ${prefix + command}`)
                quoted.msg.viewOnce = false
                await hisoka.sendMessage(m.from, { forward: quoted }, { quoted: m })
            }
            break
            case "ai": case "chatgpt": case "gpt": case "openai": {
                if (!m.text) return m.reply(`Cara makenya gini cuy,\ncontoh: ${m.prefix + m.command} bagaimana cara bertanya`)
                await m.reply("wait")
                let req = await (await api("vhyt")).get("/tools/chatgpt3", { q: m.text })
                if (req.status !== true) return m.reply('notFound')
                await m.reply(req.data)
            }
            break
            case "aiimg": case "midjourney": {
                if (!m.text) return m.reply(`Cara makenya gini cuy,\ncontoh: ${m.prefix + m.command} rehan ganteng xixixi`)
                await m.reply("wait")
                let req = await (await api("vhyt")).get("/tools/midjourney", { q: m.text }, { responseType: "arraybuffer" })
                if (req.err) return m.reply("notFound")
                await m.reply(req)
            }
            break
            /* for download menu  */

            // case "tiktok": case "tt": {
            //     if (!/https?:\/\/(www\.|v(t|m|vt)\.|t\.)?tiktok\.com/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://vt.tiktok.com/ZSwWCk5o/`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/tiktoknowm", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req.message)
            //     if (/music/g.test(req.result.url)) {
            //         req = await (await api("xfarr")).get("/api/download/tiktokslide", { url: Func.isUrl(m.text)[0] }, "apikey")
            //         if (req.status !== 200) return m.reply(req?.message || "error")
            //         for (let url of req.result.url) {
            //             m.reply(url)
            //             await Func.sleep(5000) // delay 5 seconds
            //         }
            //     } else m.reply(req.result.url, { caption: `${req.result.author}\n\n${req.result.description}` })
            // }
            // break
            // case "instagram": case "ig": case "igdl": {
            //     if (!/https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://www.instagram.com/p/CITVsRYnE9h/`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/instagram", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     for (let url of req.result) {
            //         m.reply(url, { caption: req?.result?.caption })
            //     }
            // }
            // break
            // case "facebook": case "fb": case "fbdl": {
            //     if (!/https?:\/\/(fb\.watch|(www\.|web\.|m\.)?facebook\.com)/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://www.facebook.com/watch/?v=2018727118289093`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/facebook", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req?.result?.url?.hd || req?.result?.url?.sd, { caption: req?.result?.title })
            // }
            // break
            // case "drive": case "gdrive": {
            //     if (!/https:\/\/drive\.google\.com\/file\/d\/(.*?)\//i.test(m.text)) return m.reply(`Example : ${prefix + command} https://drive.google.com/file/d/0B_WlBmfJ3KOfdlNyVWwzVzQ1QTQ/view?resourcekey=0-P3IayYTmxJ5d8vSlf-CpUA`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/gdrive", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req?.result?.url, { fileName: req?.result?.name, mimetype: req?.result?.mimetype })
            // }
            // break
            // case "imgur": {
            //     if (!/https:\/\/imgur\.com\/gallery\//i.test(m.text)) return m.reply(`Example : ${prefix + command} https://imgur.com/gallery/ksnRO`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/imgur", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req?.result?.video || req?.result?.image)
            // }
            // break
            // case "mediafire": {
            //     if (!/https?:\/\/(www\.)?mediafire\.com\/(file|download)/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://www.mediafire.com/file/96mscj81p92na3r/images+(35).jpeg/file`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/mediafire", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req?.result?.link, { fileName: a?.result?.name, mimetype: a?.result?.mime })
            // }
            // break
            // case "pinterest": {
            //     if (!m.text) return m.reply(`Example :\n\n1. ${prefix + command} Hisoka\n2. ${prefix + command} https://id.pinterest.com/pin/936748791217202640`)
            //     await m.reply("wait")
            //     if (/(?:https?:\/\/)?(?:id\.)?(?:pinterest\.com|pin\.it)\/\W*/i.test(m.text)) {
            //         let req = await (await api("xfarr")).get("/api/download/pinterest", { url: Func.isUrl(m.text)[0] }, "apikey")
            //         if (req.status !== 200) return m.reply(req?.message || "error")
            //         await m.reply(req?.result?.[0]?.url)
            //     } else {
            //         let req = await (await api("xfarr")).get("/api/search/pinterest", { query: m.text }, "apikey")
            //         if (req.status !== 200) return m.reply(req?.message || "error")
            //         let res = req.result[Math.floor(Math.random() * req.result.length)]
            //         await m.reply(res.image, { caption: res.caption })
            //     }
            // }
            // break
            // case "twitter": {
            //     if (!/https?:\/\/(www\.)?(twitter|X)\.com\/.*\/status/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://twitter.com/CJDLuffy/status/1683219386595721216?t=EN1LZTURgFYexHISfC3keg&s=19`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/twittervideo", { url: Func.isUrl(m.text)[0] }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req?.result?.url[0], { caption: req.result.caption })
            // }
            // break
            // case "ytv": {
            //     if (!/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?(?:music\.)?youtube\.com\/(?:watch|v|embed|shorts))/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://youtu.be/_EYbfKMTpRs`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/ytvideo", { url: Func.isUrl(m.text) }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req.result.result[0].download, { fileName: req.result.title + ".mp4", mimetype: "video/mp4" })
            // }
            // break
            // case "yta": {
            //     if (!/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?(?:music\.)?youtube\.com\/(?:watch|v|embed|shorts))/i.test(m.text)) return m.reply(`Example : ${prefix + command} https://youtu.be/_EYbfKMTpRs`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/ytaudio", { url: Func.isUrl(m.text) }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req.result.result[0].download, { fileName: req.result.title + ".mp3", mimetype: "audio/mpeg" })
            // }
            // break
            // case "apk": case "apkdl": {
            //     if (!m.text) return m.reply(`Example : ${m.prefix + m.command} com.whatsapp`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get("/api/download/apk", { package: m.text }, "apikey")
            //     if (req.status !== 200) return m.reply(req?.message || "error")
            //     let text = `${req.result.name}\n\n• Package : ${req.result.package}\n• Size : ${Func.formatSize(req.result.size)}\n• Release : ${req.result.added}\n• Updated : ${req.result.updated}\n• Version : ${req.result.file?.vername}\n• CPU Support : ${req.result.file?.hardware?.cpus.join(", ")}`
            //     let msg = await m.reply(req.result.media.screenshots[0].url, { caption: text })    
            //     let url = req.result.file?.path || req.result.file?.path_alt
            //     await hisoka.sendMedia(m.from, url, msg, { asDocument: true, fileName: req.result.name + (Func.mime(url)).ext, mimetype: (Func.mime(url)).mime })
            // }
            // break
            // case "spotify": {
            //     if (!/(?:https?:\/\/)?(?:open\.)?spotify.com(?:\/[a-zA-Z0-9\-]+)?\/track\//i.test(m.text)) return m.reply(`Example : ${m.prefix + m.command} https://open.spotify.com/track/3W4U7TEgILGpq0EmquurtH`)
            //     await m.reply("wait")
            //     let req = await (await api("xfarr")).get(`/api/download/spotify`, { url: Func.isUrl(m.text)[0] }, "apikey", { responseType: "arraybuffer" })
            //     if (req?.status && req.status !== 200) return m.reply(req?.message || "error")
            //     await m.reply(req)
            // }
            // break

            /* for non command */
            default:
                // ini eval ya dek
                if ([">", "eval", "=>"].some(a => m.body?.toLowerCase()?.startsWith(a))) {
                    if (!m.isOwner) return m.reply("owner")
                    let evalCmd = ""
                    try {
                        evalCmd = /await/i.test(m.text) ? eval("(async() => { " + m.text + " })()") : eval(m.text)
                    } catch (e) {
                        evalCmd = e
                    }
                    new Promise(async (resolve, reject) => {
                        try {
                            resolve(evalCmd);
                        } catch (err) {
                            reject(err)
                        }
                    })
                        ?.then((res) => m.reply(format(res)))
                        ?.catch((err) => m.reply(format(err)))
                }

                // nah ini baru exec dek
                if (["$", "exec"].some(a => m.body?.toLowerCase()?.startsWith(a))) {
                    if (!m.isOwner) return m.reply("owner")
                    try {
                        exec(m.text, async (err, stdout) => {
                            if (err) return m.reply(Func.format(err))
                            if (stdout) return m.reply(Func.format(stdout))
                        })
                    } catch (e) {
                        m.reply(Func.format(e))
                    }
                }

                // cek bot active or no
                if (/^.start/i.test(m.body)) {
                    m.reply(`Bot is Active!`)
                }
        }
    } catch (e) {
        m.reply(format(e))
    }
}
