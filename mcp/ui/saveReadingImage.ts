import type { App } from '@modelcontextprotocol/ext-apps';
import type { ReadingImage, SavedReadingImage } from '@/host/tarotHost';

type FileHost = {
  uploadFile?(file: File, options: {library: boolean}): Promise<{fileId: string}>;
  getFileDownloadUrl?(input: {fileId: string}): Promise<{downloadUrl: string}>;
  setWidgetState?(state: {modelContent: string; privateContent: {savedImageName: string}; imageIds: string[]}): void;
};

/** Feature detection keeps the original app usable across MCP hosts. */
export async function saveReadingImage(app: App, image: ReadingImage): Promise<SavedReadingImage> {
  const prefix='data:image/png;base64,';
  if(!image.dataUrl.startsWith(prefix)) throw new Error('Expected a PNG reading image');
  const blob=image.dataUrl.slice(prefix.length);
  if(app.getHostCapabilities()?.downloadFile) {
    const result=await app.downloadFile({contents:[{type:'resource',resource:{
      uri:`file:///${image.name}`,mimeType:'image/png',blob,
    }}]});
    if(result.isError) throw new Error('Image download was not accepted');
    return {destination:'download',name:image.name};
  }
  const fileHost=(window as Window & {openai?:FileHost}).openai;
  if(fileHost?.uploadFile) {
    const bytes=Uint8Array.from(atob(blob),c=>c.charCodeAt(0));
    const {fileId}=await fileHost.uploadFile(new File([bytes],image.name,{type:'image/png'}),{library:true});
    if(!fileId) throw new Error('The host did not return a saved file');
    fileHost.setWidgetState?.({modelContent:`Saved reading image: ${image.name}`,privateContent:{savedImageName:image.name},imageIds:[fileId]});
    // A download-link failure must not report an already uploaded file as unsaved.
    const downloadUrl=await fileHost.getFileDownloadUrl?.({fileId}).then(r=>r.downloadUrl).catch(()=>undefined);
    return {destination:'library',name:image.name,downloadUrl};
  }
  throw new Error('This host does not support image exports. Open the website to download the PNG.');
}
