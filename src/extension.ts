import * as vscode from "vscode";
const axios = require("axios");
const md5 = require("md5");

const appid = vscode.workspace
  .getConfiguration()
  .get("chinese-variable-naming.appid");
const secret = vscode.workspace
  .getConfiguration()
  .get("chinese-variable-naming.secret");

const status = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "chinese-variable-naming.naming",
    () => {
      naming();
    }
  );

  context.subscriptions.push(disposable);
}

async function naming() {
  const currentEditor: vscode.TextEditor = vscode.window.activeTextEditor!;
  let selectedText = getSelectedText();
  if (selectedText && /^\w+$/.test(selectedText)) {
    return;
  }
  showStatus("请求中...");
  let res: any = null;
  setTimeout(() => {
    if (res === null) {
      showStatus(`请求失败，请检查网络`, "$(error)");
    }
  }, 2000);
  res = await translate(selectedText, "zh", "en");
  if (!res.data) {
    return;
  }
  const { data } = res;
  if (data.error_code) {
    // @ts-ignore
    if (errorCodeObj[data.error_code]) {
      // @ts-ignore
      showStatus(errorCodeObj[data.error_code], "$(error)");
    } else {
      showStatus("请求失败，请检查网络或 appid、 secret", "$(error)");
    }
    return;
  }
  if (data.trans_result.length === 0) {
    showStatus("没有翻译结果", "$(error)");
    return;
  }

  const translatedText = data.trans_result[0].dst;
  const namedText = await worldSplit(translatedText, selectedText);
  if (!getSelectedText()) {
    return;
  }
  currentEditor.edit((editBuilder) => {
    editBuilder.replace(currentEditor.selection, namedText);
  });
}

function getSelectedText() {
  const currentEditor = vscode.window.activeTextEditor;
  if (!currentEditor) {
    return "";
  }
  const currentSelect = currentEditor.document.getText(currentEditor.selection);
  if (!currentSelect) {
    return "";
  }
  return currentSelect.trim() || "";
}

const errorCodeObj = {
  10000: "查询长字符串,请在插件配置项配置自己的百度翻译appid",
  52001: "请求超时...",
  52003: "请检查您自定义的appid是否正确",
  54003: "服务器繁忙,请稍后再试",
  54005: "请降低长query的发送频率，3s后再试",
};

function translate(q: string, from: string, to: string) {
  const salt = Math.random();
  return axios({
    method: "get",
    url: "https://fanyi-api.baidu.com/api/trans/vip/translate",
    params: {
      q,
      appid,
      from,
      to,
      salt,
      sign: md5(appid + q + salt + secret),
    },
    timeout: 2000,
  });
}
async function worldSplit(translatedText: string, selectedText: string) {
  let selectWord = "";
  const list = translatedText.split(" ");
  if (list.length > 1) {
    const arr = [];
    arr.push(
      list
        .map((v, i) => {
          if (i !== 0) {
            return v.charAt(0).toLocaleUpperCase() + v.slice(1);
          }
          return v.toLocaleLowerCase();
        })
        .join("")
    );
    arr.push(
      list.map((v) => v.charAt(0).toLocaleUpperCase() + v.slice(1)).join("")
    );
    arr.push(list.map((v) => v.toLocaleLowerCase()).join("_"));

    arr.push(list.map((v) => v.toLocaleLowerCase()).join("-"));
    arr.push(translatedText);
    selectWord =
      (await vscode.window.showQuickPick(arr, {
        placeHolder: "请选择要替换的变量名",
      })) || "";
  } else {
    selectWord = list[0];
  }
  return selectWord ? selectWord : selectedText;
}

function showStatus(tips: string, icon = "$(megaphone)") {
  status.text = icon + "  " + tips;
  status.show();
}

export function deactivate() {}
