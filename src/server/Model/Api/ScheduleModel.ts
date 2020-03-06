import * as apid from '../../../../node_modules/mirakurun/api';
import DateUtil from '../../Util/DateUtil';
import RuleUtil from '../../Util/RuleUtil';
import * as DBSchema from '../DB/DBSchema';
import { ProgramsDBInterface } from '../DB/ProgramsDB';
import { ServicesDBInterface } from '../DB/ServicesDB';
import { IPCClientInterface } from '../IPC/IPCClient';
import { SearchInterface } from '../Operator/RuleInterface';
import ApiModel from './ApiModel';
import ApiUtil from './ApiUtil';

interface ScheduleModelInterface extends ApiModel {
    getSchedule(time: number, length: number, type: apid.ChannelType): Promise<{}[]>;
    getScheduleId(time: number, channelId: number, days: number): Promise<{}>;
    getScheduleDetail(programId: number): Promise<{}>;
    getBroadcasting(addition: number): Promise<{}>;
    searchProgram(searchOption: SearchInterface): Promise<{}[]>;
    updateReserves(): Promise<void>;
}

namespace ScheduleModelInterface {
    export const channelIdIsNotFoundError = 'channelIdIsNotFound';
    export const programlIdIsNotFoundError = 'programIdIsNotFound';
    export const searchOptionIsIncorrect = 'searchOptionIsIncorrect';
}

class ScheduleModel extends ApiModel implements ScheduleModelInterface {
    private programsDB: ProgramsDBInterface;
    private servicesDB: ServicesDBInterface;
    private ipc: IPCClientInterface;

    constructor(
        programsDB: ProgramsDBInterface,
        servicesDB: ServicesDBInterface,
        ipc: IPCClientInterface,
    ) {
        super();
        this.programsDB = programsDB;
        this.servicesDB = servicesDB;
        this.ipc = ipc;
    }

    /**
     * 番組データを取得
     * @param time: YYMMDDHH
     * @param length: 長さ
     * @param type: 放送波
     * @return Promise<{}[]>
     */
    public async getSchedule(time: number, length: number, type: apid.ChannelType): Promise<{}[]> {
        const times = this.getTime(time, length);
        const programs = await this.programsDB.findSchedule(times.startAt, times.endAt, type);
        const channels = await this.servicesDB.findChannelType([type], true);

        // channelId ごとに programs をまとめる
        const programsIndex: { [key: number]: any[] } = {};
        for (const program of programs) {
            if (typeof programsIndex[program.channelId] === 'undefined') {
                programsIndex[program.channelId] = [];
            }

            programsIndex[program.channelId].push(ApiUtil.deleteNullinHash(program));
        }

        // 結果を格納する
        const results: any[] = [];
        for (const channel of channels) {
            if (typeof programsIndex[channel.id] === 'undefined') { continue; }
            results.push({
                channel: this.createChannel(channel),
                programs: programsIndex[channel.id],
            });
        }

        return results;
    }

    /**
     * チャンネル別の番組データを取得
     * @param time: YYMMDDHH
     * @param channelId: channel id
     * @param days: 日数
     * @return Promise<{}>
     */
    public async getScheduleId(time: number, channelId: number, days: number): Promise<{}> {
        const times = this.getTime(time, 24);
        const programs: DBSchema.ScheduleProgramItem[][] = [];
        for (let i = 0; i < days; i++) {
            const addTime = i * 24 * 60 * 60 * 1000;
            programs.push(await this.programsDB.findScheduleId(times.startAt + addTime, times.endAt + addTime, channelId));
        }

        const channel = await this.servicesDB.findId(channelId);

        if (channel === null) { throw new Error(ScheduleModelInterface.channelIdIsNotFoundError); }

        return programs.map((program) => {
            return {
                channel: this.createChannel(channel!),
                programs: program,
            };
        });
    }

    /**
     * program id を指定して番組データを取得
     * @param programid: prgoram id
     * @return Promise<{}>
     */
    public async getScheduleDetail(programId: number): Promise<{}> {
        const program = await this.programsDB.findIdMiniColumn(programId);
        if (program === null) { throw new Error(ScheduleModelInterface.programlIdIsNotFoundError); }

        const channel = await this.servicesDB.findId(program.channelId);
        if (channel === null) { throw new Error(ScheduleModelInterface.channelIdIsNotFoundError); }

        return [{
            channel: this.createChannel(channel),
            programs: [ApiUtil.deleteNullinHash(program)],
        }];
    }

    /**
     * 放映中の番組データを取得
     * @param addition 加算時間(分)
     * @return Promise<{}>
     */
    public async getBroadcasting(addition: number): Promise<{}> {
        const programs = await this.programsDB.findBroadcasting(addition * 1000 * 60);
        const channels = await this.servicesDB.findAll(true);

        // channelId ごとに programs をまとめる
        const programsIndex: { [key: number]: any[] } = {};
        for (const program of programs) {
            if (typeof programsIndex[program.channelId] === 'undefined') {
                programsIndex[program.channelId] = [];
            }

            programsIndex[program.channelId].push(ApiUtil.deleteNullinHash(program));
        }

        // 結果を格納する
        const results: any[] = [];
        for (const channel of channels) {
            if (typeof programsIndex[channel.id] === 'undefined') { continue; }
            results.push({
                channel: this.createChannel(channel),
                programs: [ programsIndex[channel.id][0] ],
            });
        }

        return results;
    }

    /**
     * time (YYMMDDHH) から startAt, endAt を取得する
     * @param time: number
     * @return startAt, endAt
     */
    private getTime(time: number, length: number): { startAt: apid.UnixtimeMS; endAt: apid.UnixtimeMS } {
        const timeStr = typeof time === 'undefined' ? DateUtil.format(DateUtil.getJaDate(new Date()), 'YYMMddhh') : String(time);
        const startAt = new Date(`20${ timeStr.substr(0, 2) }/${ timeStr.substr(2, 2) }/${ timeStr.substr(4, 2) } ${ timeStr.substr(6, 2) }:00:00 +0900`).getTime();
        const endAt = startAt + (length * 60 * 60 * 1000);

        return {
            startAt: startAt,
            endAt: endAt,
        };
    }

    /**
     * DBSchema.ServiceSchema からデータを生成
     * @param channel: DBSchema.ServiceSchema
     * @return {}
     */
    private createChannel(channel: DBSchema.ServiceSchema): {} {
        const c = {
            id: channel.id,
            serviceId: channel.serviceId,
            networkId: channel.networkId,
            name: channel.name,
            hasLogoData: channel.hasLogoData,
            channelType: channel.channelType,
        };
        if (channel.remoteControlKeyId !== null) { c['remoteControlKeyId'] = channel.remoteControlKeyId; }

        return c;
    }

    /**
     * rule 検索
     * @param searchOption: SearchInterface
     * @return Promise<{}[]>
     */
    public async searchProgram(searchOption: SearchInterface): Promise<{}[]> {
        if (!(RuleUtil.checkRuleSearch(searchOption))) {
            // searchOption が正しく指定されていない
            throw new Error(ScheduleModelInterface.searchOptionIsIncorrect);
        }
        const searchLimit = this.config.getConfig().searchLimit || 300;
        const programs = await this.programsDB.findRule(searchOption, true, searchLimit);

        return programs.map((program) => {
            return ApiUtil.deleteNullinHash(program);
        });
    }

    /**
     * 予約情報更新
     * @return Promise<void>
     */
    public async updateReserves(): Promise<void> {
        await this.ipc.updateReserves();
    }
}

export { ScheduleModelInterface, ScheduleModel };

