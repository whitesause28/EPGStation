import { throttle } from 'lodash';
import * as m from 'mithril';
import Util from '../../Util/Util';
import BalloonViewModel from '../../ViewModel/Balloon/BalloonViewModel';
import factory from '../../ViewModel/ViewModelFactory';
import Component from '../Component';

interface ControlArgs {
    disableControl?: boolean;
    isLiveStreaming?: boolean;
    disableSpeedControl?: boolean;
    enableCloseButton?: boolean;
    closeButtonCallback?(): void;
    video: m.Child | null;
    height?: number;
    subtitleCallbacks?: {
        isEnabled(): boolean;
        enable(): void;
        disable(): void;
    };
}

/**
 * VideoContainerComponent
 */
class VideoContainerComponent extends Component<ControlArgs> {
    private balloon: BalloonViewModel;
    private containerElement: HTMLElement | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private controlerElement: HTMLElement | null = null;
    private disableControl: boolean = false;
    private isLiveStreaming: boolean = false;
    private seekBar: number = 0;
    private speed: number = 1;
    private stopTimeUpdate: boolean = false;
    private keyDwonListener = ((e: KeyboardEvent) => { this.onKeyDown(e); }).bind(this);
    private fullScreenListener = (() => { this.fullscreenChange(); }).bind(this);
    private isEnablePip: boolean;
    private controlHideTimerId: number;
    private disableMouseleave = false;
    private doubleClickFlag = false;
    private doubleClickTimerId: number;
    private isWaiting: boolean = false;
    private isEnabledRotation: boolean = typeof (<any> window.screen).orientation !== 'undefined' && Util.uaIsMobile();

    constructor() {
        super();

        this.balloon = <BalloonViewModel> factory.get('BalloonViewModel');
    }

    /**
     * view
     */
    public view(vnode: m.Vnode<ControlArgs, this>): m.Children {
        this.disableControl = !!vnode.attrs.disableControl;
        this.isLiveStreaming = !!vnode.attrs.isLiveStreaming;

        if (!!vnode.attrs.disableSpeedControl) {
            this.speed = 1;
        }

        return m('div', {
            class: 'video-container'
                + (this.isLiveStreaming ? ' live-streaming' : '')
                + (Util.uaIsMobile() ? ' mobile' : '')
                + (!this.isEnablePip ? ' disable-pip' : '')
                + (this.isPipMode() ? ' pip-mode' : '')
                + (!!vnode.attrs.disableSpeedControl ? ' disable-speed-control' : '')
                + (this.isEnabledRotation ? ' enabled-rotation' : ''),
            style: !this.isFullScreen() && typeof vnode.attrs.height !== 'undefined' ? `height: ${ vnode.attrs.height }px;` : '',
            oncreate: (mainVnode: m.VnodeDOM<void, any>) => {
                const element = <HTMLElement> mainVnode.dom;
                this.setElements(element);
                if (this.disableControl) { return; }

                this.seekBar = 0;
                this.speed = 1;
                this.stopTimeUpdate = false;

                document.addEventListener('keydown', this.keyDwonListener, false);
                document.addEventListener('webkitfullscreenchange', this.fullScreenListener, false);
                document.addEventListener('mozfullscreenchange', this.fullScreenListener, false);
                document.addEventListener('MSFullscreenChange', this.fullScreenListener, false);
                document.addEventListener('fullscreenchange', this.fullScreenListener, false);

                let mouseTimer: number;
                element.addEventListener('mousemove', throttle(() => {
                    clearTimeout(mouseTimer);
                    this.showMouseCursor();

                    mouseTimer = window.setTimeout(() => { this.hideMouseCursor(); }, 1000);
                }, 100), false);
            },
            onupdate: (mainVnode: m.VnodeDOM<void, any>) => {
                this.setElements(<HTMLElement> mainVnode.dom);
            },
            onremove: () => {
                this.videoElement = null;
                this.containerElement = null;
                this.seekBar = 0;
                this.speed = 1;
                this.stopTimeUpdate = false;
                this.isWaiting = false;

                if (this.disableControl) { return; }
                document.removeEventListener('keydown', this.keyDwonListener, false);
                document.removeEventListener('webkitfullscreenchange', this.fullScreenListener, false);
                document.removeEventListener('mozfullscreenchange', this.fullScreenListener, false);
                document.removeEventListener('MSFullscreenChange', this.fullScreenListener, false);
                document.removeEventListener('fullscreenchange', this.fullScreenListener, false);
            },
            onclick: () => {
                if (this.controlerElement === null) { return; }

                if (this.doubleClickFlag) {
                    clearTimeout(this.doubleClickTimerId);
                    this.doubleClickFlag = false;

                    this.switchFullScreen();

                    return;
                }

                this.doubleClickFlag = true;
                this.doubleClickTimerId = window.setTimeout(() => {
                    this.doubleClickFlag = false;
                }, 200);

                if (this.isHidingControl()) {
                    this.showControl();
                } else {
                    this.hideControl();
                }

                if (this.disableMouseleave) {
                    this.disableMouseleave = false;
                }
            },
        }, [
            this.createLoading(),
            vnode.attrs.video,
            this.createControl(vnode),
        ]);
    }

    /**
     * on keydown
     * @param event: KeyboardEvent
     */
    private onKeyDown(event: KeyboardEvent): void {
        if (this.disableControl || this.videoElement === null) { return; }

        // space key 入力時に再生状態の反転
        if (event.keyCode === 32) {
            this.switchPlay();
        }

        if (!this.isLiveStreaming) {
            // -10 seek
            if (event.keyCode === 37) {
                this.backTime(10);
                m.redraw();
            }

            // +10 seek
            if (event.keyCode === 39) {
                this.skipTime(10);
                m.redraw();
            }
        }

        // switch mute
        if (event.keyCode === 77) {
            this.switchMute();
        }
    }

    /**
     * on fullscreenChange
     * iOS では動作しないので注意
     */
    private fullscreenChange(): void {
        if (this.containerElement === null) { return; }

        if (this.isFullScreen()) {
            this.containerElement.classList.add('fullscreen');
            this.hideMouseCursor();
        } else {
            this.containerElement.classList.remove('fullscreen');
            this.showMouseCursor();
            window.setTimeout(() => { this.balloon.enableClose(); }, 1000);
        }

        m.redraw();

        window.setTimeout(() => { this.hideControl(); }, VideoContainerComponent.VideoSeekInterval);
    }

    /**
     * hide control
     */
    private hideControl(time: number = 0): void {
        if (this.controlerElement === null) { return; }

        const controlerElement = this.controlerElement;
        this.controlHideTimerId = window.setTimeout(() => {
            controlerElement.classList.add('hide');
        }, time);
    }

    /**
     * show control
     */
    private showControl(): void {
        if (this.controlerElement === null) { return; }

        clearTimeout(this.controlHideTimerId);
        const controlerElement = this.controlerElement;
        window.setTimeout(() => { controlerElement.classList.remove('hide'); }, 0);
    }

    /**
     * control が隠れているか
     * @return boolean
     */
    private isHidingControl(): boolean {
        return this.controlerElement !== null && this.controlerElement.classList.contains('hide');
    }

    /**
     * mouse cursor を非表示にする
     */
    private hideMouseCursor(): void {
        if (this.containerElement === null) { return; }

        this.containerElement.classList.add('hide-mouse-cursor');
    }

    /**
     * mouse cursor を表示する
     */
    private showMouseCursor(): void {
        if (this.containerElement === null) { return; }

        this.containerElement.classList.remove('hide-mouse-cursor');
    }

    /**
     * set elements
     * @param container: HTMLElement
     */
    private setElements(container: HTMLElement): void {
        this.containerElement = container;
        const videos = container.getElementsByTagName('video');

        if (videos.length > 0) {
            const needVideoSetting = this.videoElement === null;
            this.videoElement = <HTMLVideoElement> videos[0];
            this.videoElement.controls = this.disableControl;

            this.videoElement.preload = 'none';
            this.videoElement.setAttribute('playsinline', 'true');
            this.videoElement.setAttribute('autoplay', 'true');

            if (this.isFullScreen()) {
                this.videoElement.setAttribute('height', '100%');
                this.videoElement.setAttribute('width', '100%');
            } else {
                this.videoElement.setAttribute('height', '$auto');
                this.videoElement.setAttribute('width', '100%');
            }

            // set pip
            this.isEnablePip = (<any> this.videoElement).webkitSupportsPresentationMode
                && typeof (<any> this.videoElement).webkitSupportsPresentationMode === 'function'
                && !Util.uaIsiPhone();

            if (needVideoSetting) {
                if (!this.disableControl) {
                    this.seekBar = 0;
                    this.speed = 1;

                    // 時刻更新時
                    this.videoElement.addEventListener('timeupdate', () => {
                        this.timeupdate();
                    });
                }

                // 読み込み中
                this.videoElement.addEventListener('waiting', () => {
                    this.isWaiting = true;
                    m.redraw();
                });

                // 読み込み完了
                this.videoElement.addEventListener('loadeddata', () => {
                    this.isWaiting = false;
                    m.redraw();
                });

                // 再生可能
                this.videoElement.addEventListener('canplay', () => {
                    this.isWaiting = false;
                    m.redraw();
                });

                // 終了
                this.videoElement.addEventListener('ended', () => {
                    this.isWaiting = false;
                    m.redraw();
                });
            }
        } else {
            this.videoElement = null;
            if (!this.disableControl && !this.isWaiting) {
                m.redraw();
            }
            this.isWaiting = true;
        }
    }

    /**
     * video timeupdate
     */
    private timeupdate(): void {
        if (this.videoElement === null || this.stopTimeUpdate) { return; }

        const newSeekBar = (VideoContainerComponent.VideoSeekInterval / this.getVideoDuration()) * this.getVideoCurrentTime();
        this.seekBar = isNaN(newSeekBar) || newSeekBar === Infinity ? 0 : newSeekBar;
        m.redraw();

        // slider
        if (this.containerElement === null) { return; }
        const l = this.containerElement.getElementsByClassName('mdl-slider__background-lower');
        const u = this.containerElement.getElementsByClassName('mdl-slider__background-upper');
        if (l.length === 0 || u.length === 0) { return; }
        const lower = <HTMLElement> l[0];
        const upper = <HTMLElement> u[0];

        const value = this.seekBar / VideoContainerComponent.VideoSeekInterval;
        lower.style.flexGrow = `${ value }`;
        upper.style.flexGrow = `${ 1 - value }`;
    }

    /**
     * get video duration
     * @return number
     */
    protected getVideoDuration(): number {
        if (this.videoElement === null) { return 0; }
        const duration = this.videoElement.duration;

        return duration === Infinity || isNaN(duration) ? 0 : duration;
    }

    /**
     * get video current time
     * @return number
     */
    protected getVideoCurrentTime(): number {
        if (this.videoElement === null) { return 0; }
        const currentTime = this.videoElement.currentTime;

        return currentTime === Infinity || isNaN(currentTime) ? 0 : currentTime;
    }

    /**
     * update video currentTime
     */
    protected updateVideoCurrentTime(position: number): void {
        if (this.videoElement === null) { return; }

        this.videoElement.currentTime = position;
    }

    /**
     * seekbar から動画再生位置を取得
     * @return number
     */
    private getSeekCurrentTime(): number {
        if (this.videoElement === null) { return 0; }

        return Math.floor(this.getVideoDuration()) * (this.seekBar / VideoContainerComponent.VideoSeekInterval);
    }

    /**
     * loading
     * @return m.Child | null
     */
    private createLoading(): m.Child | null {
        if (this.isWaiting) {
            return m('div', {
                class: 'loading-video-content ios-no-click-color',
                onclick: () => {},
            }, [
                m('div', {
                    class: 'mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active',
                }),
            ]);
        } else if (this.disableControl) {
            return null;
        } else {
            return m('div', {
                class: 'loading-video-content hide ios-no-click-color',
                onclick: () => {},
            }, 'not-loading');
        }
    }

    /**
     * createControls
     * vnode: m.Vnode<ControlArgs, this>
     * @return m.Child | null
     */
    private createControl(vnode: m.Vnode<ControlArgs, this>): m.Child | null {
        if (this.disableControl || this.videoElement === null) { return null; }

        const isMobile = Util.uaIsMobile();
        const timeStr = this.createDurationStr();

        const titlesChild = [];

        if (!!vnode.attrs.enableCloseButton) {
            titlesChild.push(m('i', {
                class: 'close material-icons mdl-shadow--2dp',
                onclick: () => {
                    if (typeof vnode.attrs.closeButtonCallback === 'undefined') { return; }

                    if (this.isFullScreen()) {
                        this.switchFullScreen();
                    } else {
                        vnode.attrs.closeButtonCallback();
                    }
                },
            }, 'close'));
        }

        if (this.isEnabledRotation) {
            titlesChild.push(m('i', {
                class: 'rotation material-icons mdl-shadow--2dp',
                onclick: () => { this.switchRotation(); },
            }, 'screen_rotation'));
        }

        return m('div', {
            class: 'video-controls mdl-shadow--2dp ios-no-click-color ' + (isMobile && !Util.uaIsAndroid() ? '' : 'hide'),
            oncreate: (mainVnode: m.VnodeDOM<void, any>) => {
                this.controlerElement = <HTMLElement> mainVnode.dom;
            },
            onremove: () => {
                this.controlerElement = null;
            },
            onclick: (event: Event) => {
                if (isMobile && this.isHidingControl()) { return; }
                event.stopPropagation();
            },
            onmouseenter: () => {
                if (this.disableMouseleave || isMobile) { return; }

                this.showControl();
            },
            onmouseleave: () => {
                if (this.disableMouseleave || isMobile) { return; }

                this.hideControl(300);
            },
        }, [
            m('div', { class: 'titles' }, titlesChild),
            m('div', { class: 'times' }, [
                m('span', { class: 'current-time' }, timeStr.current),
                m('input', {
                    class: 'seek-bar mdl-slider mdl-js-slider',
                    type: 'range',
                    value: this.seekBar,
                    min: 0,
                    max: VideoContainerComponent.VideoSeekInterval,
                    onupdate: (v: m.VnodeDOM<void, any>) => {
                        v.dom.classList.remove('is-lowest-value');
                    },
                    onchange: (e: Event) => {
                        // seekbar 移動完了時
                        this.stopTimeUpdate = false;
                        if (this.videoElement === null) { return; }

                        this.seekBar = parseInt((<HTMLInputElement> e.target!).value, 10);
                        this.updateVideoCurrentTime(this.getSeekCurrentTime());
                    },
                    oninput: (e: Event) => {
                        // seekbar 移動中
                        this.stopTimeUpdate = true;
                        this.seekBar = parseInt((<HTMLInputElement> e.target!).value, 10);
                    },
                }),
                m('span', { class: 'duration' }, timeStr.duration),
            ]),
            m('div', { class: 'buttons-parent' }, [
                m('div', { class: 'volume-buttons' }, [
                    this.createSubtitle(vnode),
                    m('i', {
                        class: 'mute material-icons',
                        onclick: () => {
                            this.switchMute();
                        },
                    }, this.videoElement.muted || this.videoElement.volume === 0 ? 'volume_off' : 'volume_up'),
                    m('input', {
                        class: 'volume-bar mdl-slider mdl-js-slider',
                        type: 'range',
                        min: '0',
                        max: '1',
                        step: '0.1',
                        value: this.videoElement.volume,
                        oninput: (e: Event) => {
                            if (this.videoElement === null) { return; }

                            this.videoElement.volume = parseFloat((<HTMLInputElement> e.target!).value);
                        },
                    }),
                ]),

                m('div', {
                    class: 'play-buttons',
                }, [
                    this.createBackButton(30, 'option'),
                    this.createBackButton(10),
                    m('i', {
                        class: 'play-pause material-icons',
                        onclick: () => {
                            this.switchPlay();
                        },
                    }, this.videoElement.paused ? 'play_arrow' : 'pause'),
                    this.createSkipButton(10),
                    this.createSkipButton(30, 'option'),
                ]),
                m('div', { class: 'right-buttons' }, [
                    m('div', { class: 'pulldown speed mdl-layout-spacer' }, [
                        m('select', {
                            class: 'mdl-textfield__input program-dialog-label',
                            onfocus: () => {
                                this.disableMouseleave = true;
                            },
                            onchange: (e: Event) => {
                                this.speed = parseFloat((<HTMLInputElement> e.target!).value);
                                this.disableMouseleave = false;

                                if (this.videoElement === null) { return; }
                                this.videoElement.playbackRate = this.speed;
                            },
                            onupdate: (v: m.VnodeDOM<void, any>) => {
                                this.selectOnUpdate(<HTMLInputElement> v.dom, this.speed);

                                if (this.videoElement === null) { return; }
                                this.videoElement.playbackRate = this.speed;
                            },
                        }, this.createSpeedValues()),
                    ]),
                    m('i', {
                        class: 'pip material-icons',
                        type: 'button',
                        onclick: () => {
                            this.switchPip();
                        },
                    }, this.isPipMode() ? 'picture_in_picture_alt' : 'picture_in_picture'),
                    m('i', {
                        class: 'full-screen material-icons',
                        type: 'button',
                        onclick: () => {
                            this.switchFullScreen();
                        },
                    }, this.isFullScreen() ? 'fullscreen_exit' : 'fullscreen'),
                ]),
            ]),
        ]);
    }

    /**
     * create speed values
     * @return m.Child[];
     */
    private createSpeedValues(): m.Child[] {
        const results: m.Child[] = [];

        for (let i = 5; i <= 20; i += 1) {
            const value = i / 10;
            results.push(m('option', { value: value }, `x${ value.toFixed(1) }`));
        }

        return results;
    }

    /**
     * create back button
     * @param time: number
     * @param addClassStr: string
     * @return m.Chuld
     */
    private createBackButton(time: number, addClassStr: string = ''): m.Child {
        return m('i', {
            class: 'play-back material-icons ' + addClassStr,
            onclick: () => { this.backTime(time); },
        }, `replay_${ time }`);
    }

    /**
     * create skip button
     * @param time: number
     * @param addClassStr: string
     * @return m.Chuld
     */
    private createSkipButton(time: number, addClassStr: string = ''): m.Child {
        return m('i', {
            class: 'play-skip material-icons ' + addClassStr,
            onclick: () => { this.skipTime(time); },
        }, `forward_${ time }`);
    }

    /**
     * back
     * @param time: number
     */
    private backTime(time: number): void {
        const currentTime = this.getVideoCurrentTime();
        if (this.videoElement === null || currentTime <= 0) { return; }

        const backTime = currentTime - time;
        this.updateVideoCurrentTime(backTime < 0 ? 0 : backTime);

        this.seekBar = backTime / Math.floor(this.getVideoDuration()) * VideoContainerComponent.VideoSeekInterval;
    }

    /**
     * switch play
     */
    private switchPlay(): void {
        if (this.videoElement === null) { return; }

        if (this.videoElement.paused) {
            this.videoElement.play();
        } else {
            this.videoElement.pause();
        }
    }

    /**
     * seek
     * @param time: number
     */
    private skipTime(time: number): void {
        if (this.videoElement === null) { return; }

        const duration = Math.floor(this.getVideoDuration());
        const skipTime = this.getVideoCurrentTime() + time;
        this.updateVideoCurrentTime(skipTime > duration ? duration : skipTime);

        this.seekBar = skipTime / Math.floor(this.getVideoDuration()) * VideoContainerComponent.VideoSeekInterval;
    }

    /**
     * 再生位置
     * @return string
     */
    private createDurationStr(): { current: string; duration: string } {
        if (this.videoElement === null) {
            return {
                current: '--:--',
                duration: '--:--',
            };
        }

        const c = this.getTimeData(this.getSeekCurrentTime());
        const d = this.getTimeData(this.getVideoDuration());

        if (d === null || c === null) {
            return {
                current: '00:00',
                duration: '--:--',
            };
        }

        if (d.h > 0) {
            return {
                current: `${ this.zeroPadding(c.h) }:${ this.zeroPadding(c.m) }:${ this.zeroPadding(c.s) }`,
                duration: `${ this.zeroPadding(d.h) }:${ this.zeroPadding(d.m) }:${ this.zeroPadding(d.s) }`,
            };
        } else {
            return {
                current: `${ this.zeroPadding(c.m) }:${ this.zeroPadding(c.s) }`,
                duration: `${ this.zeroPadding(d.m) }:${ this.zeroPadding(d.s) }`,
            };
        }
    }

    /**
     * @param time: number
     * @return { h: number; m: number; s: number } | null
     */
    private getTimeData(time: number): { h: number; m: number; s: number } | null {
        if (time === Infinity) { return null; }
        if (isNaN(time)) {
            return {
                h: 0,
                m: 0,
                s: 0,
            };
        }

        time = Math.floor(time);

        return {
            h: time / 3600 | 0,
            m: time % 3600 / 60 | 0,
            s: time % 60,
        };
    }

    /**
     * 0 埋め
     * @param num: number
     * @return string
     */
    private zeroPadding(num: number): string {
        return (`0${num}`).slice(-2);
    }

    /**
     * 字幕ボタン生成
     */
    private createSubtitle(vnode: m.Vnode<ControlArgs, this>): m.Child | null {
        if (typeof vnode.attrs.subtitleCallbacks === 'undefined') { return null; }
        const callbacks = vnode.attrs.subtitleCallbacks;

        return m('i', {
            class: 'subtitle material-icons ' + (callbacks.isEnabled() ? '' : ' disable'),
            onclick: () => {
                if (callbacks.isEnabled()) {
                    callbacks.disable();
                } else {
                    callbacks.enable();
                }
            },
        }, 'subtitles');
    }

    /**
     * switch mute
     */
    private switchMute(): void {
        if (this.videoElement === null) { return; }

        this.videoElement.muted = !this.videoElement.muted;
    }

    /**
     * video が inline か?
     */
    private isPipMode(): boolean {
        return this.isEnablePip && this.videoElement !== null && (<any> this.videoElement).webkitPresentationMode === 'picture-in-picture';
    }

    /**
     * switch pip
     */
    private switchPip(): void {
        if (!this.isEnablePip) { return; }

        (<any> this.videoElement!).webkitSetPresentationMode((<any> this.videoElement!).webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
    }

    /**
     * swich full screen
     */
    private switchFullScreen(): void {
        if (this.containerElement === null) { return; }

        if (this.isFullScreen()) {
            if (document.exitFullscreen) { document.exitFullscreen(); }
            else if ((<any> document).mozCancelFullScreen) { (<any> document).mozCancelFullScreen(); }
            else if ((<any> document).webkitCancelFullScreen) { (<any> document).webkitCancelFullScreen(); }
            else if ((<any> document).msExitFullscreen) { (<any> document).msExitFullscreen(); }
        } else {
            this.balloon.disableClose();

            if (!this.requestFullscreen(this.containerElement) && this.videoElement !== null) {
                this.requestFullscreen(this.videoElement);
            }

            // 画面回転
            this.switchRotation();

            window.setTimeout(() => {
                if (!this.isFullScreen() || Util.uaIsiOS()) {
                    this.balloon.enableClose();
                }
            }, 1000);
        }
    }

    /**
     * full screen か
     * @return boolean
     */
    private isFullScreen(): boolean {
        return !!((<any> document).fullScreen || (<any> document).webkitIsFullScreen || (<any> document).mozFullScreen || (<any> document).msFullscreenElement || (<any> document).fullscreenElement) || (this.videoElement !== null && (<any> this.videoElement).webkitDisplayingFullscreen);
    }

    /**
     * full screen element
     * @param e: HTMLElement
     * @return boolean true: 成功, false: 失敗
     */
    private requestFullscreen(e: HTMLElement): boolean {
        /* tslint:disable:newline-before-return */
        if (Util.uaIsAndroid()) { e.requestFullscreen({ navigationUI: 'hide'});  }
        else if (e.requestFullscreen) { e.requestFullscreen(); return true; }
        else if ((<any> e).mozRequestFullScreen) { (<any> e).mozRequestFullScreen(); return true; }
        else if ((<any> e).webkitRequestFullScreen) { (<any> e).webkitRequestFullScreen(); return true; }
        else if ((<any> e).webkitEnterFullscreen) { (<any> e).webkitEnterFullscreen(); return true; }
        else if ((<any> e).msRequestFullscreen) { (<any> e).msRequestFullscreen(); return true; }
        /* tslint:enable:newline-before-return */

        return false;
    }

    /**
     * full screen 時の画面回転状態を変更
     */
    private async switchRotation(): Promise<void> {
        if (!this.isEnabledRotation) { return; }

        try {
            if (this.isLandscape()) {
                await (<any> window.screen).orientation.lock('natural');
            } else {
                await (<any> window.screen).orientation.lock('landscape');
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * 回転状態か？
     */
    private isLandscape(): boolean {
        return !this.isEnabledRotation || (<any> window.screen).orientation.angle !== 0;
    }
}

namespace VideoContainerComponent {
    export const VideoSeekInterval = 1000;
}

export default VideoContainerComponent;

