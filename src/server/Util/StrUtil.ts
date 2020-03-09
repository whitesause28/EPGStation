import * as Enums from '../Enums';

/**
 * 文字周りの Util
 */
namespace StrUtil {
    /**
     * 文字列をデータベース用文字列に変換する．
     *
     * convertDBStrの値によって以下のように文字列の変換を行う
     *    - 'no': PostgreSQL非対応文字の削除
     *    - 'twoByte': PostgreSQL非対応文字の削除，半角英数記号を全角に変換
     *    - else: PostgreSQL非対応文字の削除，全角英数記号を半角に変換
     * @param str: string
     * @param convertDBStr: string
     * @return string
     */
    export const toDBStr = (str: string, convertDBStr: Enums.ConvertStrType): string => {
      const ret = convertDBStr === 'no' ? str : convertDBStr === 'twoByte' ? toDouble(str) : toHalf(str);

      return ret.replace(/\x00/g, ''); // PostgreSQL 非対応文字
    };

    /**
     * 全角英数記号を半角へ変換する
     * @param str: string
     * @return string
     */
    export const toHalf = (str: string): string => {
        const tmp = str.replace(/[！-～]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });

        return tmp.replace(/”/g, '"')
            .replace(/’/g, '\'')
            .replace(/‘/g, '`')
            .replace(/￥/g, '\\')
            // tslint:disable-next-line:no-irregular-whitespace
            .replace(/　/g, ' ')
            .replace(/〜/g, '~');
    };

    /**
     * 半角英数記号を全角へ変換する
     * @param str: string
     * @return string
     */
    export const toDouble = (str: string): string => {
        const tmp = str.replace(/\\/g, '￥').replace(/[!-~]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        });

        return tmp.replace(/"/g, '”')
            .replace(/\'/g, '’')
            .replace(/`/g, '‘')
            // tslint:disable-next-line:no-irregular-whitespace
            .replace(/ /g, '　')
            .replace(/~/g, '〜')
            .replace(/［/g, '[')
            .replace(/］/g, ']');
    };

    /**
     * [] を中身ごと削除し 先頭と末尾のスペースを削除する
     * @param str: string
     * @return string
     */
    export const deleteBrackets = (str: string): string => {
        return str.replace(/\[.*\]|[\u{1F14A}\u{1F14C}\u{1F13F}\u{1F146}\u{1F14B}\u{1F210}\u{1F211}\u{1F212}\u{1F213}\u{1F142}\u{1F214}\u{1F215}\u{1F216}\u{1F14D}\u{1F131}\u{1F13D}\u{1F217}\u{1F218}\u{1F219}\u{1F21A}\u{1F21B}\u{26BF}\u{1F21C}\u{1F21D}\u{1F21E}\u{1F21F}\u{1F220}\u{1F221}\u{1F222}\u{1F223}\u{1F224}\u{1F225}\u{1F14E}\u{3299}\u{1F200}]*/ug, '').trim();
    };
}

export default StrUtil;

