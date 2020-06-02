import * as b24js from 'b24.js';
import * as m from 'mithril';
import * as apid from '../../../../api';
import { ViewModelStatus } from '../../Enums';
import { ConfigApiModelInterface } from '../../Model/Api/ConfigApiModel';
import { StreamsApiModelInterface } from '../../Model/Api/StreamsApiModel';
import { SettingValue } from '../../Model/Setting/SettingModel';
import { SnackbarModelInterface } from '../../Model/Snackbar/SnackbarModel';
import StorageTemplateModel from '../../Model/Storage/StorageTemplateModel';
import { StreamWatchVideoSettingValue } from '../../Model/Stream/StreamWatchVideoSettingModel';
import Util from '../../Util/Util';
import ViewModel from '../ViewModel';

/**
 * StreamWatchViewModel
 */
class StreamWatchViewModel extends ViewModel {
    private streamApiModel: StreamsApiModelInterface;
    private streamNumber: number | null = null;
    private config: ConfigApiModelInterface;
    private setting: StorageTemplateModel<SettingValue>;
    private subtitleSetting: StorageTemplateModel<StreamWatchVideoSettingValue>;
    private snackbar: SnackbarModelInterface;
    private viewerURL: string | null = null;
    private b24RendererGetter: (() => b24js.WebVTTRenderer | null) | null = null; // b24 レンダラーインスタンスを取得する

    constructor(
        streamApiModel: StreamsApiModelInterface,
        config: ConfigApiModelInterface,
        setting: StorageTemplateModel<SettingValue>,
        subtitleSetting: StorageTemplateModel<StreamWatchVideoSettingValue>,
        snackbar: SnackbarModelInterface,
    ) {
        super();
        this.streamApiModel = streamApiModel;
        this.config = config;
        this.setting = setting;
        this.subtitleSetting = subtitleSetting;
        this.snackbar = snackbar;
    }

    /**
     * init
     */
    public async init(status: ViewModelStatus = 'init'): Promise<void> {
        super.init(status);

        if (status === 'init' || status === 'update') {
            this.streamNumber = typeof m.route.param('stream') === 'undefined' ? null : Number(m.route.param('stream'));
            this.streamApiModel.init();
        }

        await this.streamApiModel.fetchInfos();
        await this.setUrlScheme();
    }

    /**
     * b24 レンダラー取得関数のセット
     * @param callback
     */
    public setB24RendererGetter(callback: (() => b24js.WebVTTRenderer | null) | null): void {
        this.b24RendererGetter = callback;
    }

    /**
     * url scheme の設定
     */
    private async setUrlScheme(): Promise<void> {
        const config = this.config.getConfig();
        if (config === null) {
            await Util.sleep(500);

            return await this.setUrlScheme();
        }

        const setting = this.setting.getValue();

        // 設定で有効でない
        if (!setting.isEnableHLSViewerURLScheme) {
            this.viewerURL = null;

            return;
        }

        let baseURL = setting.customHLSViewerURLScheme;

        if (baseURL === null && typeof config.HLSViewer !== 'undefined') {
            if ((Util.uaIsiOS() || Util.uaIsiPadOS()) && typeof config.HLSViewer.ios !== 'undefined') {
                baseURL = config.HLSViewer.ios;
            } else if (Util.uaIsAndroid() && typeof config.HLSViewer.android !== 'undefined') {
                baseURL = config.HLSViewer.android;
            } else if (Util.uaIsMac() && typeof config.HLSViewer.mac !== 'undefined') {
                baseURL = config.HLSViewer.mac;
            } else if (Util.uaIsWindows() && typeof config.HLSViewer.win !== 'undefined') {
                baseURL = config.HLSViewer.win;
            }
        }

        if (baseURL === null) { return; }

        let source = `${ location.host }${ this.getSource() }`;
        if (baseURL.match(/vlc-x-callback/)) { source = encodeURIComponent(source); }

        this.viewerURL = baseURL.replace(/ADDRESS/g, source);
    }

    /**
     * アプリで開く場合の url を取得する
     * @return string | null
     */
    public getCustomURL(): string | null {
        return this.viewerURL;
    }

    /**
     * get info
     * @return apid.StreamInfo | null
     */
    public getInfo(): apid.StreamInfo | null {
        const info = this.streamApiModel.getInfos().find((stream) => {
            return stream.streamNumber === this.streamNumber;
        });

        return typeof info === 'undefined' ? null : info;
    }

    /**
     * isEnable
     * @return boolean true: ビデオ再生可能, false: ビデオ再生不可能
     */
    public isEnable(): boolean {
        const info = this.getInfo();

        return info === null ? false : info.isEnable;
    }

    /**
     * video の src を返す
     * @return string
     */
    public getSource(): string {
        return this.streamNumber === null ? '' : `./streamfiles/stream${ this.streamNumber }.m3u8`;
    }

    /**
     * ストリームの停止
     */
    public async stop(): Promise<void> {
        if (this.streamNumber === null) { return; }

        await this.streamApiModel.stop(this.streamNumber);
    }

    /**
     * open snackbar
     * @param msg: message
     */
    public openSnackbar(msg: string): void {
        this.snackbar.open(msg);
    }

    /**
     * 字幕表示状態を返す
     * @return true で表示
     */
    public isEnabledSubtitle(): boolean {
        return this.subtitleSetting.getValue().isEnabledSubtitle;
    }

    /**
     * 字幕表示
     */
    public showSubtitle(): void {
        if (this.b24RendererGetter === null) { return; }

        const render = this.b24RendererGetter();
        if (render !== null) {
            render.show();
            this.subtitleSetting.setValue({ isEnabledSubtitle: true });
        }
    }

    /**
     * 字幕非表示
     */
    public hideSubtitle(): void {
        if (this.b24RendererGetter === null) { return; }

        const render = this.b24RendererGetter();
        if (render !== null) {
            render.hide();
            this.subtitleSetting.setValue({ isEnabledSubtitle: false });
        }
    }

    /**
     * ブラウザ内蔵のプレーヤを使用するか
     * @return true: 内蔵のプレーヤを使用する
     */
    public isNativePlayer(): boolean {
        return this.setting.getValue().isEnableNativeHLSVideoPlayer;
    }
}

namespace StreamWatchViewModel {
    export const videoId = 'stream-watch-video';
}

export default StreamWatchViewModel;

