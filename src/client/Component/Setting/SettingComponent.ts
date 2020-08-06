import * as m from 'mithril';
import { ViewModelStatus } from '../../Enums';
import Util from '../../Util/Util';
import SettingViewModel from '../../ViewModel/Setting/SettingViewModel';
import factory from '../../ViewModel/ViewModelFactory';
import MainLayoutComponent from '../MainLayoutComponent';
import ParentComponent from '../ParentComponent';

/**
 * SettingComponent
 */
class SettingComponent extends ParentComponent<void> {
    private viewModel: SettingViewModel;

    constructor() {
        super();
        this.viewModel = <SettingViewModel> factory.get('SettingViewModel');
    }

    protected async parentInitViewModel(status: ViewModelStatus): Promise<void> {
        if (status === 'init') {
            this.viewModel.resetTmp();
        }
        await Util.sleep(100);
    }

    /**
     * page name
     */
    protected getComponentName(): string { return 'Setting'; }

    /**
     * view
     */
    public view(): m.Child {
        return m(MainLayoutComponent, {
            header: { title: '設定' },
            content: [
                this.createContent(),
            ],
            scrollStoped: (scrollTop: number) => {
                this.saveHistoryData(scrollTop);
            },
        });
    }

    /**
     * create content
     * @return m.Child
     */
    public createContent(): m.Child {
        const buttonHover = Util.uaIsMobile() ? ' no-hover' : '';

        let fixScroll: m.Child | null = null;
        if (Util.uaIsAndroid()) {
            fixScroll = this.createListItem(
                '番組表スクロール修正',
                this.createToggle(
                    () => { return this.viewModel.tmpValue.programFixScroll; },
                    (value) => { this.viewModel.tmpValue.programFixScroll = value; },
                ),
            );
        }

        let minimumDrawing: m.Child | null = null;
        if (!Util.uaIsSafari()) {
            minimumDrawing = this.createListItem(
                '番組表描画範囲の最小化',
                this.createToggle(
                    () => { return this.viewModel.tmpValue.programMinimumDrawing; },
                    (value) => { this.viewModel.tmpValue.programMinimumDrawing = value; },
                ),
            );
        }

        let hlsVideoPlayer: m.Child | null = null;
        if (Util.uaIsSafari()) {
            hlsVideoPlayer = this.createListItem(
                'HLS 視聴時にブラウザ内蔵のプレーヤを使用する',
                this.createToggle(
                    () => { return this.viewModel.tmpValue.isEnableNativeHLSVideoPlayer; },
                    (value) => { this.viewModel.tmpValue.isEnableNativeHLSVideoPlayer = value; },
                ),
            );
        }

        return m('div', {
            class : 'setting-content mdl-card mdl-shadow--2dp mdl-cell mdl-cell--12-col',
            onupdate: () => { this.restoreMainLayoutPosition(); },
        }, [
            m('ul', { class: 'mdl-list' }, [
                this.createListItem(
                    'ナビゲーションを自動で開く',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isAutoOpenNavigation; },
                        (value) => { this.viewModel.tmpValue.isAutoOpenNavigation = value; },
                    ),
                ),

                this.createListItem(
                    'ページ移動アニメーション',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isEnabledPageMovementAnimation; },
                        (value) => { this.viewModel.tmpValue.isEnabledPageMovementAnimation = value; },
                    ),
                ),

                fixScroll,
                minimumDrawing,

                this.createListItem(
                    '番組表時間',
                    m('div', { class: 'pulldown mdl-layout-spacer' }, [
                        m('select', {
                            class: 'mdl-textfield__input program-dialog-label',
                            onchange: (e: Event) => {
                                this.viewModel.tmpValue.programLength = parseInt((<HTMLInputElement> e.target!).value, 10);
                            },
                            onupdate: (vnode: m.VnodeDOM<void, this>) => {
                                this.selectOnUpdate(<HTMLInputElement> (vnode.dom), this.viewModel.tmpValue.programLength);
                            },
                        }, this.createLengthOption(24)),
                    ]),
                ),

                this.createListItem(
                    '録画番組表示件数',
                    m('div', { class: 'pulldown mdl-layout-spacer' }, [
                        m('select', {
                            class: 'mdl-textfield__input program-dialog-label',
                            onchange: (e: Event) => {
                                this.viewModel.tmpValue.recordedLength = parseInt((<HTMLInputElement> e.target!).value, 10);
                            },
                            onupdate: (vnode: m.VnodeDOM<void, this>) => {
                                this.selectOnUpdate(<HTMLInputElement> (vnode.dom), this.viewModel.tmpValue.recordedLength);
                            },
                        }, this.createLengthOption()),
                    ]),
                ),

                this.createListItem(
                    '予約表示件数',
                    m('div', { class: 'pulldown mdl-layout-spacer' }, [
                        m('select', {
                            class: 'mdl-textfield__input program-dialog-label',
                            onchange: (e: Event) => {
                                this.viewModel.tmpValue.reservesLength = parseInt((<HTMLInputElement> e.target!).value, 10);
                            },
                            onupdate: (vnode: m.VnodeDOM<void, this>) => {
                                this.selectOnUpdate(<HTMLInputElement> (vnode.dom), this.viewModel.tmpValue.reservesLength);
                            },
                        }, this.createLengthOption()),
                    ]),
                ),

                this.createListItem(
                    'ルール表示件数',
                    m('div', { class: 'pulldown mdl-layout-spacer' }, [
                        m('select', {
                            class: 'mdl-textfield__input program-dialog-label',
                            onchange: (e: Event) => {
                                this.viewModel.tmpValue.ruleLength = parseInt((<HTMLInputElement> e.target!).value, 10);
                            },
                            onupdate: (vnode: m.VnodeDOM<void, this>) => {
                                this.selectOnUpdate(<HTMLInputElement> (vnode.dom), this.viewModel.tmpValue.ruleLength);
                            },
                        }, this.createLengthOption()),
                    ]),
                ),

                this.createListItem(
                    'ライブ視聴のURL設定',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isEnableMegTsStreamingURLScheme; },
                        (value) => { this.viewModel.tmpValue.isEnableMegTsStreamingURLScheme = value; },
                    ),
                ),
                this.createTextBox(
                    () => {
                        const value = this.viewModel.tmpValue.customMegTsStreamingURLScheme;

                        return value === null ? '' : value;
                    },
                    (value) => {
                        this.viewModel.tmpValue.customMegTsStreamingURLScheme = value ? value : null;
                    },
                    'URL Scheme',
                ),

                this.createListItem(
                    '録画視聴のURL設定',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isEnableRecordedViewerURLScheme; },
                        (value) => { this.viewModel.tmpValue.isEnableRecordedViewerURLScheme = value; },
                    ),
                ),
                this.createListItem(
                    'Web Player での再生を優先する',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.prioritizeWebPlayerOverURLScheme; },
                        (value) => { this.viewModel.tmpValue.prioritizeWebPlayerOverURLScheme = value; },
                    ),
                ),
                this.createTextBox(
                    () => {
                        const value = this.viewModel.tmpValue.customRecordedViewerURLScheme;

                        return value === null ? '' : value;
                    },
                    (value) => {
                        this.viewModel.tmpValue.customRecordedViewerURLScheme = value ? value : null;
                    },
                    'URL Scheme',
                ),

                this.createListItem(
                    '録画保存のURL設定',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isEnableRecordedDownloaderURLScheme; },
                        (value) => { this.viewModel.tmpValue.isEnableRecordedDownloaderURLScheme = value; },
                    ),
                ),
                this.createTextBox(
                    () => {
                        const value = this.viewModel.tmpValue.customRecordedDownloaderURLScheme;

                        return value === null ? '' : value;
                    },
                    (value) => {
                        this.viewModel.tmpValue.customRecordedDownloaderURLScheme = value ? value : null;
                    },
                    'URL Scheme',
                ),

                this.createListItem(
                    'HLS 視聴のURL設定',
                    this.createToggle(
                        () => { return this.viewModel.tmpValue.isEnableHLSViewerURLScheme; },
                        (value) => { this.viewModel.tmpValue.isEnableHLSViewerURLScheme = value; },
                    ),
                ),
                hlsVideoPlayer,
                this.createTextBox(
                    () => {
                        const value = this.viewModel.tmpValue.customHLSViewerURLScheme;

                        return value === null ? '' : value;
                    },
                    (value) => {
                        this.viewModel.tmpValue.customHLSViewerURLScheme = value ? value : null;
                    },
                    'URL Scheme',
                ),
            ]),

            m('div', { class: 'mdl-dialog__actions' }, [
                m('button', {
                    type: 'button',
                    class: 'mdl-button mdl-js-button mdl-button--primary' + buttonHover,
                    onclick: () => { this.viewModel.save(); },
                }, '保存'),

                m('button', {
                    type: 'button',
                    class: 'mdl-button mdl-js-button mdl-button--accent close' + buttonHover,
                    onclick: () => { this.viewModel.reset(); },
                }, 'リセット'),
            ]),
        ]);
    }

    /**
     * create list item
     * @param name: name
     * @param child m.child
     * @return m.Child
     */
    private createListItem(name: string, child: m.Child): m.Child {
        return m('li', { class: 'mdl-list__item' }, [
            m('span', { class: 'mdl-list__item-primary-content' }, name),
            m('span', { class: 'mdl-list__item-secondary-action' }, child),
        ]);
    }

    /**
     * create length option
     * @param maxValue: number
     * @return m.Child[]
     */
    private createLengthOption(maxValue: number = 100): m.Child[] {
        const results: m.Child[] = [];

        for (let i = 1; i <= maxValue; i++) {
            results.push(m('option', { value: i }, i));
        }

        return results;
    }

    /**
     * create Toggle
     * @param getValue: () => boolean 入力値
     * @param setValue: (value: boolean) => void toogle 変更時に実行される
     * @return m.Child
     */
    private createToggle(getValue: () => boolean, setValue: (value: boolean) => void): m.Child {
        return m('label', {
            class: 'mdl-switch mdl-js-switch mdl-js-ripple-effect',
            onupdate: (vnode: m.VnodeDOM<void, this>) => {
                this.toggleLabelOnUpdate(<HTMLInputElement> vnode.dom, getValue());
            },
        }, [
            m('input', {
                type: 'checkbox',
                class: 'mdl-switch__input',
                checked: getValue(),
                onclick: (e: Event) => {
                    setValue((<HTMLInputElement> e.target!).checked);
                },
            }),
            m('span', { class: 'mdl-switch__label' }),
        ]);
    }

    /**
     * create TextBox
     * @param getValue: () => string
     * @param setValue: (value: string) => void,
     * @param placeholder: string
     * @return m.Child
     */
    private createTextBox(getValue: () => string, setValue: (value: string) => void, placeholder: string): m.Child {
        return m('li', { class: 'mdl-list__item' }, [
            m('div', { class: 'mdl-cell--12-col mdl-textfield mdl-js-textfield' }, [
                 m('input', {
                    class: 'mdl-textfield__input',
                    type: 'text',
                    placeholder: placeholder,
                    value: getValue(),
                    onchange: (e: Event) => { setValue((<HTMLInputElement> e.target!).value); },
                }),
            ]),
        ]);
    }
}

export default SettingComponent;

