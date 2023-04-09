import Requests from "E:/Github/zotero-reference/src/modules/requests";

import localStorage from "./localStorage";
import { config } from "../../package.json";

let lock: undefined | _ZoteroPromiseObject = undefined
const utils = {
  requests: new Requests(),
  localStorage: new localStorage(config.addonRef),
  wait(item: Zotero.Item, key: string, local: boolean=true) {
    switch (key) {
      case "publication":
        const publicationTitle = this.getPublicationTitle(item)
        if (publicationTitle == "") { return }
        let data
        if (local) {
          data = this.localStorage.get(item, key)
        }
        if (data !== undefined) { return data }
        // 开启一个异步更新影响因子
        let secretKey = Zotero.Prefs.get(`${config.addonRef}.easyscholar.secretKey`) as string
        window.setTimeout(async () => {
          this.requests.cache = {}
          if (secretKey) {
            await lock;
            lock = Zotero.Promise.defer()
            let response
            try {
              response = await this.requests.get(
                `https://easyscholar.cc/open/getPublicationRank?secretKey=${secretKey}&publicationName=${encodeURIComponent(publicationTitle)}`,
              )
            } catch { console.log(response) }
            // 延迟
            await Zotero.Promise.delay(1000)
            lock!.resolve()
            if (response && response.data) {
              // 自定义数据集+官方数据集合并
              let officialAllData = response.data.officialRank.all
              if (!officialAllData) {
                if (!local) {
                  new ztoolkit.ProgressWindow("Publication Tags", { closeTime: 3000, closeOtherProgressWindows: true })
                    .createLine({ text: "Not Found", type: "default" }).show()
                }
                return await this.localStorage.set(item, key, "")
              }
              let customRankInfo = response.data.customRank.rankInfo
              response.data.customRank.rank.forEach((rankString: string) => {
                try {
                  // 1613160542602600448&&&2
                  let uuid: string, rank: string;
                  [uuid, rank] = rankString.split("&&&")
                  rank = {
                    "1": "oneRankText",
                    "2": "twoRankText",
                    "3": "threeRankText",
                    "4": "fourRankText",
                    "5": "fiveRankText"
                  }[rank] as string
                  let info = customRankInfo.find((i:any) => i.uuid == uuid)
                  officialAllData[info.abbName] = info[rank]
                } catch {}
              })
              if (officialAllData) {
                await this.localStorage.set(item, key, officialAllData)
                // 显示它支持的所有字段
                let popupWin = new ztoolkit.ProgressWindow("Publication Tags", { closeTime: 3000, closeOtherProgressWindows: true }).show()
                popupWin.createLine({text: publicationTitle, type: "default"})
                Object.keys(officialAllData).forEach(k => {
                  popupWin.createLine({ text: `${k}: ${officialAllData[k]}`, type: "success" })
                })
                ztoolkit.ItemTree.refresh()
              }
            }
          } else {
            if (!local) {
              new ztoolkit.ProgressWindow("Publication Tags", { closeTime: 3000, closeOtherProgressWindows: true })
                .createLine({ text: "No easyScholar secret key configured", type: "fail" }).show()
            }
          }
        })
        return 
      default:
        break
    }
  },
  getPublicationTitle(item: Zotero.Item) {
    return [item.getField("publicationTitle"), item.getField("proceedingsTitle")].find(i=>i.trim().length > 0)
  }
}

export default utils