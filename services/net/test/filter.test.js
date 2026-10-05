// 채팅 거르개
import { describe, it, expect } from 'vitest';
import { filterText, hasProfanity, maskText, maskSplitPhone } from '../src/filter.js';

const masked = text => filterText(text).text;

describe('filterText', () => {
  it('masks profanity including spacing, digit and jamo tricks', () => {
    expect(masked('안녕 시발')).toBe('안녕 **');
    expect(masked('시 발 놈아')).toBe('* * 놈아');
    expect(masked('시1발')).toBe('***');
    expect(masked('ㅅㅂ')).toBe('**');
    expect(masked('ㅅ.ㅂ')).toBe('***');
    expect(masked('병​신')).toBe('**');
    expect(masked('이 새끼야')).toBe('이 **야');
    expect(masked('F*CK you')).toBe('**** you');
    expect(masked('ｆｕｃｋ')).toBe('****');
    expect(filterText('개새끼').kinds).toEqual(['profanity']);
  });

  it('leaves ordinary sentences alone', () => {
    for (const ok of ['다시 발로 차', '1시 발표', '시발점에서 출발', '시바견 귀여워', '새끼손가락 걸고 약속', 'class assignment', '이번 판 3:2 이겼다',
      '좋은 게임!', 'GG wp', '점수 100점', 'v1.2 업데이트', '라인 좋아', '인스타 좋아', '점수 1234567 점', '고마워 ㅎㅎ']) {
      expect(filterText(ok), ok).toEqual({ text: ok, kinds: [] });
    }
  });

  it('does not treat Korean number syllables inside ordinary words as phone digits', () => {
    expect(masked('내 번호 010-1234-5678 이야')).toBe('내 번호 ************* 이야');
    expect(masked('내 번호 공일공 일이삼사 오육칠팔 이야')).toBe('내 번호 *** **** **** 이야');
    expect(maskSplitPhone(['010-1234-5678'], '이야')).toBe('이야');
    expect(filterText('번호공일공일이삼사오육칠팔이야').kinds).toContain('phone');
    expect(filterText('이야기 재미있다')).toEqual({ text: '이야기 재미있다', kinds: [] });
  });

  it('masks Korean phone numbers in many shapes', () => {
    for (const phone of ['010-1234-5678', '01012345678', '010 1234 5678', '010.1234.5678', '0 1 0 1 2 3 4 5 6 7 8', '+82 10 1234 5678', '02-123-4567', '공일공 일이삼사 오육칠팔', '０１０１２３４５６７８']) {
      const r = filterText(`내 번호 ${phone} 야`);
      expect(r.kinds, phone).toContain('phone');
      expect(r.text, phone).not.toMatch(/[0-9０-９]{3}/);
    }
  });

  it('masks links, emails and messenger ids', () => {
    for (const [input, kind] of [
      ['naver.com 가봐', 'link'], ['https://evil.example/x', 'link'], ['www.abc.kr', 'link'], ['abc 닷 com', 'link'], ['abc닷컴', 'link'],
      ['me@gmail.com', 'link'], ['me 골뱅이 gmail 닷 com', 'link'], ['카톡 아이디 abc123', 'contact'], ['카톡은 kid_99', 'contact'],
      ['인스타 @cool.kid', 'contact'], ['디코 name#1234', 'contact'], ['아이디: hello12', 'contact'],
    ]) {
      const r = filterText(input);
      expect(r.kinds, input).toContain(kind);
      expect(r.text, input).toMatch(/\*{3}/);
    }
    expect(masked('카톡 아이디 abc123')).toBe('** *** ******');
  });

  it('trims, removes control characters and cuts long text', () => {
    expect(masked('  hi\n there\t ')).toBe('hi there');
    expect([...filterText('가'.repeat(500)).text]).toHaveLength(200);
    expect([...filterText('가'.repeat(500), { max: 300 }).text]).toHaveLength(300);
    expect(masked(null)).toBe('');
  });

  it('hasProfanity for nicknames', () => {
    expect(hasProfanity('시발맨')).toBe(true);
    expect(hasProfanity('ssibal')).toBe(true);
    expect(hasProfanity('인혁')).toBe(false);
    expect(hasProfanity('Sussex_1')).toBe(false);
  });

  it('normalizes full-width letters, ideographic dots and spaced-out links before looking, and masks the original text', () => {
    for (const [input, kind] of [
      ['ｅｘａｍｐｌｅ．ｃｏｍ', 'link'], ['n a v e r . c o m', 'link'], ['naver。com', 'link'], ['ｈｔｔｐｓ://x', 'link'],
      ['카톡아이디abc123', 'contact'], ['ktalk: abc123', 'contact'], ['디스코드 닉 abc', 'contact'],
      ['공일공에 일이삼사에 오육칠팔', 'phone'], ['O1O-I234-5678', 'phone'], ['010\u200b1234\u200b5678', 'phone'], ['시바', 'profanity'],
    ]) {
      const r = filterText(input);
      expect(r.kinds, input).toContain(kind);
      expect(r.text.replace(/[*\s]/g, ''), input).toBe(''); // 가린 자리는 원래 글자 위치 그대로
      expect([...r.text].length, input).toBe([...input.replace(/\u200b/g, '')].length);
    }
    expect(masked('ｅｘａｍｐｌｅ．ｃｏｍ 봐')).toBe('*********** 봐');
    expect(masked('n a v e r . c o m 와')).toBe('* * * * * * * * * 와');
    // 붙여 쓴 영어 낱말은 아이디로 보지 않는다
    for (const ok of ['idea abc', 'ideas', 'a b c', 'www 와 ㅋㅋ', '시바견 귀여워']) expect(filterText(ok), ok).toEqual({ text: ok, kinds: [] });
  });

  it('maskText masks game strings in place without trimming or cutting', () => {
    expect(maskText('  sibal010-1234-5678  ')).toBe('  ******************  ');
    expect(maskText('a'.repeat(300))).toBe('a'.repeat(300));
    expect(maskText('board:0102')).toBe('board:0102');
  });

  it('maskSplitPhone masks the line that completes a number split across lines', () => {
    expect(maskSplitPhone(['010'], '1234')).toBe('1234'); // 아직 7개
    expect(maskSplitPhone(['010', '1234'], '5678')).toBe('****');
    expect(maskSplitPhone(['내 번호 010-1234'], '5678 맞아')).toBe('**** 맞아');
    expect(maskSplitPhone([], '5678')).toBe('5678');
    expect(maskSplitPhone(['3:2 이겼다'], '다시 하자 12')).toBe('다시 하자 12');
  });
});
