import * as eapid from '../../../../api';
import * as apid from '../../../../node_modules/mirakurun/api';
import * as DBSchema from '../DB/DBSchema';
import { EncodeInterface } from './RuleInterface';

export interface ReserveProgram {
    program: DBSchema.ProgramSchema;
    encodeOption?: EncodeInterface;
    isSkip: boolean;
    isConflict: boolean;
    allowEndLack: boolean;
    option?: ReserveOptionInterface;
}

/**
 * ルール予約
 */
export interface RuleReserveProgram extends ReserveProgram {
    ruleId: number;
    isOverlap: boolean;
    disableOverlap: boolean;
}

/**
 * 手動予約
 */
export interface ManualReserveProgram extends ReserveProgram {
    manualId: number;
    isTimeSpecified?: boolean;
}

export interface ReserveOptionInterface {
    directory?: string;
    recordedFormat?: string;
}

/**
 * 予約追加時データ
 */
export interface AddReserveInterface {
    programId?: apid.ProgramId;
    allowEndLack: boolean;
    option?: ReserveOptionInterface;
    encode?: EncodeInterface;
    program?: {
        channelId: apid.ServiceItemId;
        startAt: apid.UnixtimeMS;
        endAt: apid.UnixtimeMS;
        name: string;
        description?: string;
        extended?: string;
        genre1?: eapid.ProgramGenreLv1;
        genre2?: eapid.ProgramGenreLv2;
        genre3?: eapid.ProgramGenreLv1;
        genre4?: eapid.ProgramGenreLv2;
        genre5?: eapid.ProgramGenreLv1;
        genre6?: eapid.ProgramGenreLv2;
    };
}

