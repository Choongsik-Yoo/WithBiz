"""STEP 3 static layout drawings. This file does not implement the app."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'design' / 'wireframes'
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path('C:/Windows/Fonts/malgun.ttf')
BOLD = Path('C:/Windows/Fonts/malgunbd.ttf')
C = dict(bg='#F4F7FB', panel='#FFFFFF', primary='#3157D5', navy='#173171',
         text='#172033', muted='#536179', line='#DFE5EE', selected='#E9EFFF',
         green='#0F7655', greenbg='#E8F7F0', amber='#8C5200', amberbg='#FFF3D6',
         red='#BD2C2C', redbg='#FEECEC')


class Board:
    def __init__(self, width, height):
        self.image = Image.new('RGB', (width, height), C['bg'])
        self.draw = ImageDraw.Draw(self.image)
        self.width, self.height = width, height

    def rect(self, box, fill='panel', radius=13, border=True):
        self.draw.rounded_rectangle(box, radius=radius, fill=C.get(fill, fill),
                                    outline=C['line'] if border else None, width=1)

    def text(self, xy, text, size=16, color='text', bold=False):
        font = ImageFont.truetype(str(BOLD if bold else FONT), size)
        self.draw.text(xy, text, font=font, fill=C.get(color, color), spacing=8)

    def button(self, box, label, primary=False):
        self.rect(box, 'primary' if primary else 'panel', 8, not primary)
        self.text((box[0] + 16, box[1] + 11), label, 16,
                  'panel' if primary else 'text', True)

    def badge(self, x, y, label, kind='selected', width=None):
        width = width or len(label) * 15 + 26
        self.rect((x, y, x + width, y + 32), kind, 7, False)
        color = dict(selected='primary', greenbg='green', amberbg='amber', redbg='red').get(kind, 'text')
        self.text((x + 12, y + 5), label, 15, color, True)

    def shell(self, title, subtitle):
        self.draw.rectangle((0, 0, self.width, 64), fill=C['navy'])
        self.text((26, 16), 'WithBiz', 24, 'panel', True)
        self.text((134, 19), 'AI', 21, '#83B4FF', True)
        self.text((238, 22), '정부지원사업 매칭 플랫폼', 16, 'panel')
        self.text((self.width - 226, 22), '샘플 기업  |  내 계정', 16, 'panel')
        self.draw.rectangle((0, 64, 220, self.height), fill=C['panel'])
        self.draw.line((220, 64, 220, self.height), fill=C['line'])
        names = ['대시보드', '공고 검색', '맞춤 추천', '관심 공고', '마감 캘린더', '기업 프로필', '알림 설정']
        for i, name in enumerate(names):
            y = 96 + i * 58
            if name == title:
                self.rect((12, y - 4, 207, y + 42), 'selected', 9, False)
            self.text((30, y + 6), name, 17, 'primary' if name == title else 'muted', name == title)
        self.text((252, 88), title, 30, bold=True)
        self.text((252, 136), subtitle, 16, 'muted')

    def save(self, name):
        path = OUT / name
        self.image.save(path)
        return str(path)


def metric(b, x, y, width, label, value, hint, value_color='text'):
    b.rect((x, y, x + width, y + 110))
    b.text((x + 18, y + 14), label, 16, 'muted')
    b.text((x + 18, y + 40), value, 31, value_color, True)
    b.text((x + 94, y + 65), hint, 15, 'muted')


def desktop():
    b = Board(1440, 1170)
    b.shell('대시보드', '우리 회사에 필요한 지원사업을 한눈에 확인하세요.')
    b.badge(1010, 92, '화면 설계 · 예시 데이터', width=270)
    b.text((252, 170), '샘플 기준일 2026.10.27  |  출처 연결 상태를 이 위치에 표시', 16, 'muted')
    for x, label, value, hint, color in [
        (252, '진행 중 공고', '128', '건', 'text'),
        (541, '이번 주 마감', '12', '건 · 확인 필요', 'red'),
        (830, '창업지원', '42', '건', 'primary'),
        (1119, '기업지원', '61', '건', 'text'),
    ]:
        metric(b, x, 208, 269, label, value, hint, color)
    b.rect((252, 342, 1388, 446))
    b.text((274, 356), '01  어떤 지원', 16, bold=True)
    b.text((640, 356), '02  어디서', 16, bold=True)
    b.text((1006, 356), '03  무엇이 필요', 16, bold=True)
    for x, label in [(274, '전체 유형'), (640, '전국 · 전국 공통 포함'), (1006, '전체 분야')]:
        b.button((x, 388, x + 340, 432), label + '   v')
    b.rect((252, 470, 814, 784))
    b.text((274, 488), '지역별 지원사업', 21, bold=True)
    b.text((274, 526), '지역 지도 영역 · 실제 경계 데이터 연결 예정', 16, 'muted')
    regions = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주']
    for i, region in enumerate(regions):
        col, row = i % 6, i // 6
        x, y = 274 + col * 85, 572 + row * 52
        b.rect((x, y, x + 74, y + 42), 'selected' if i % 3 else '#D9E3FF', 7, False)
        b.text((x + 12, y + 11), region, 16, 'primary')
    b.text((274, 746), '전국 공통 별도 보기  ·  지역 미확인 별도 분류', 16, 'muted')
    b.rect((838, 470, 1388, 784))
    b.text((860, 488), '지원 분야별 분포', 21, bold=True)
    for i, (label, value, width) in enumerate([('기술·R&D', '40건', 320), ('사업화·판로', '32건', 255), ('금융·투자', '28건', 224), ('인력·교육', '18건', 144)]):
        y = 541 + i * 53
        b.text((860, y), label, 16)
        b.rect((998, y + 4, 998 + width, y + 24), 'primary' if i == 0 else '#ACBDF6', 5, False)
        b.text((1325, y), value, 16, 'muted')
    b.text((252, 814), '우리 회사 맞춤 추천', 22, bold=True)
    b.text((1136, 820), '추천 전체 보기  →', 16, 'primary', True)
    for x, title, field in [(252, '중소기업 디지털 전환 지원사업', '기술 · 경기'), (832, '초기기업 사업화 지원 프로그램', '창업 · 전국')]:
        b.rect((x, 858, x + 556, 1104))
        b.badge(x + 20, 878, '설계용 예시 공고')
        b.badge(x + 412, 878, 'D-3', 'redbg', 120)
        b.text((x + 20, 926), title, 21, bold=True)
        b.text((x + 20, 964), field + '  |  예시 지원기관', 16, 'muted')
        b.text((x + 20, 1003), '예시 적합도 92점 · 지역과 관심 분야가 일치합니다.', 16, 'green')
        b.text((x + 20, 1041), '확인 필요: 매출 기준 · 최종 자격은 원문으로 확인', 16, 'muted')
    b.text((252, 1131), '정적 화면 설계입니다. 모든 수치·공고·점수는 예시이며 실행 기능을 제공하지 않습니다.', 16, 'muted')
    return b.save('dashboard-desktop.png')


def mobile():
    b = Board(440, 1370)
    b.draw.rectangle((0, 0, 440, 64), fill=C['navy'])
    b.text((20, 18), '≡', 24, 'panel')
    b.text((68, 17), 'WithBiz AI', 24, 'panel', True)
    b.text((344, 23), '내 계정', 16, 'panel')
    b.text((20, 86), '대시보드', 28, bold=True)
    b.badge(20, 132, '화면 설계 · 예시 데이터', width=258)
    b.text((20, 179), '샘플 기준일 2026.10.27', 16, 'muted')
    metric(b, 20, 216, 192, '진행 중 공고', '128', '건')
    metric(b, 228, 216, 192, '이번 주 마감', '12', '건', 'red')
    metric(b, 20, 342, 192, '창업지원', '42', '건', 'primary')
    metric(b, 228, 342, 192, '기업지원', '61', '건')
    b.rect((20, 478, 420, 694))
    b.text((38, 493), '지원사업 찾기', 20, bold=True)
    for y, label in [(534, '01  어떤 지원     전체 유형'), (585, '02  어디서         전국 공통 포함'), (636, '03  무엇이 필요  전체 분야')]:
        b.button((38, y, 402, y + 44), label)
    b.rect((20, 718, 420, 912))
    b.text((38, 735), '지역별 지원사업', 20, bold=True)
    b.text((38, 773), '모바일 지도와 동일한 지역 목록 제공', 16, 'muted')
    b.badge(38, 818, '서울', width=100)
    b.badge(150, 818, '경기', width=100)
    b.badge(262, 818, '인천', width=100)
    b.text((38, 869), '전국 공통 별도 보기  →', 16, 'primary', True)
    b.text((20, 940), '이번 주 마감', 22, bold=True)
    b.rect((20, 986, 420, 1236))
    b.badge(38, 1004, '설계용 예시 공고', width=208)
    b.badge(310, 1004, 'D-3', 'redbg', 90)
    b.text((38, 1053), '중소기업 디지털 전환', 21, bold=True)
    b.text((38, 1085), '지원사업', 21, bold=True)
    b.text((38, 1126), '예시 기관 · 기술 · 경기', 16, 'muted')
    b.button((38, 1173, 214, 1219), '공고 상세 보기', True)
    b.button((230, 1173, 402, 1219), '관심 저장')
    b.text((20, 1252), '모든 수치·공고는 예시입니다.', 16, 'muted')
    b.draw.rectangle((0, 1300, 440, 1370), fill=C['panel'])
    b.draw.line((0, 1300, 440, 1300), fill=C['line'])
    for x, label in [(22, '홈'), (98, '공고'), (184, '추천'), (270, '관심'), (351, '더보기')]:
        b.text((x, 1323), label, 17, 'primary' if label == '홈' else 'muted', label == '홈')
    return b.save('dashboard-mobile.png')


def detail():
    b = Board(1440, 1120)
    b.shell('공고 검색', '공고 상세 · 화면 설계에 사용한 예시 공고입니다.')
    b.rect((252, 186, 1388, 382))
    b.badge(276, 206, '설계용 예시 공고', width=208)
    b.badge(1268, 206, 'D-3', 'redbg', 96)
    b.text((276, 256), '중소기업 디지털 전환 지원사업', 29, bold=True)
    b.text((276, 307), '예시 지원기관  |  기업지원  |  경기  |  샘플 기준일 2026.10.27', 17, 'muted')
    b.text((276, 344), '원문 기준으로 신청 자격과 마감 시각을 최종 확인하세요.', 17, 'muted')
    b.rect((252, 406, 996, 826))
    b.text((276, 427), 'AI 요약', 23, bold=True)
    b.badge(818, 427, '시연용 결과', width=154)
    for i, (label, value) in enumerate([
        ('지원대상', '경기 소재 중소기업 · 상세 조건은 예시입니다.'),
        ('지원내용', '업무 디지털화와 기술 도입 지원'),
        ('지원규모', '예시 금액 · 원문 확인 필요'),
        ('신청기간', '2026.10.01 ~ 2026.10.30 (샘플 날짜)'),
        ('제출서류', '사업신청서 · 기업 증빙서류'),
        ('유의사항', '첨부 내용 미확인 시 별도로 표시'),
    ]):
        y = 490 + i * 49
        b.text((276, y), label, 17, 'muted', True)
        b.text((402, y), value, 17)
    b.rect((1020, 406, 1388, 826))
    b.text((1044, 427), '우리 회사 적합도', 22, bold=True)
    b.text((1044, 478), '92', 50, 'green', True)
    b.text((1140, 509), '점 · 예시', 18, 'muted')
    b.text((1044, 562), '지역과 관심 분야가 일치', 17)
    b.text((1044, 601), '확인 필요: 매출 기준', 17, 'amber')
    b.text((1044, 640), '최종 자격은 원문으로 확인', 17, 'muted')
    b.button((1044, 692, 1364, 738), '관심 공고 저장', True)
    b.button((1044, 756, 1364, 802), '공고 원문 열기  ↗')
    b.rect((252, 850, 1388, 1056))
    b.text((276, 870), '자격 조건 확인', 22, bold=True)
    b.text((276, 918), '지역: 경기', 18)
    b.badge(628, 912, '충족', 'greenbg', 100)
    b.text((276, 964), '최근 매출 기준', 18)
    b.badge(628, 958, '확인 필요', 'amberbg', 150)
    b.text((276, 1010), '기업 규모: 중소기업', 18)
    b.badge(628, 1004, '충족', 'greenbg', 100)
    b.text((868, 918), '원문 · 첨부 · 출처와 기준일', 18, 'primary', True)
    b.text((868, 964), '첨부 오류 시 원문 확인 안내 제공', 17, 'muted')
    b.text((252, 1080), '정적 화면 설계입니다. 예시 AI 요약·점수는 실제 자격 판정이 아닙니다.', 16, 'muted')
    return b.save('announcement-detail.png')


def luminance(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return sum(c * w for c, w in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(foreground, background):
    a, b = sorted((luminance(foreground), luminance(background)))
    return round((b + 0.05) / (a + 0.05), 2)


paths = [desktop(), mobile(), detail()]
pairs = [('text', 'panel'), ('muted', 'panel'), ('primary', 'panel'), ('panel', 'primary'),
         ('panel', 'navy'), ('green', 'greenbg'), ('amber', 'amberbg'), ('red', 'redbg')]
checks = [dict(foreground=C[a], background=C[b], ratio=contrast(C[a], C[b]), passesAA=contrast(C[a], C[b]) >= 4.5) for a, b in pairs]
report = dict(images=paths, contrastChecks=checks, allPairsPassAA=all(x['passesAA'] for x in checks))
(OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
