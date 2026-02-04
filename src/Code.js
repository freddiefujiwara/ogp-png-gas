function doGet(e) {
  // 1. パラメータからタイトルを取得
  const title = e.parameter.t || "No Title";
  
  // 2. テンプレートスライドのIDを指定
  const templateId = "19WVKprEJMvo0IRMY2oDEiv0yTnJRq17JpHuDSTAm-ww";
  const templateFile = DriveApp.getFileById(templateId);
  
  // 3. 一時的なコピーを作成（編集するため）
  const tempFile = templateFile.makeCopy("temp_ogp");
  const tempId = tempFile.getId();
  const presentation = SlidesApp.openById(tempId);
  const slide = presentation.getSlides()[0];
  
  // 4. テキストを置換
  slide.replaceAllText("{{title}}", title);
  presentation.saveAndClose();
  
  // 5. 画像として書き出し（サムネイル取得APIを利用）
  // ※ ここがGASで画像化する際の最大のトリックです
  const url = `https://docs.google.com/presentation/d/${tempId}/export/png`;
  const options = {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
  };
  const response = UrlFetchApp.fetch(url, options);
  const blob = response.getBlob().setName("ogp.png");
  
  // 6. 使い終わった一時ファイルを削除
  tempFile.setTrashed(true);
  
  // 7. 画像をレスポンスとして返す
  return ContentService.createTextOutput(
    Utilities.base64Encode(blob.getBytes())
  ).setMimeType(ContentService.MimeType.TEXT); 
  // ※本来は画像バイナリを返したいところですが、GASのdoGetは
  //   直接画像を返すのが難しいため、Base64などで返す工夫が必要です。
}
