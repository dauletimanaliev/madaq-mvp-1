import zipfile
import os
import json
import subprocess

os.makedirs("storage/epubs", exist_ok=True)

def create_epub(filename, title, creator, language, chapters):
    with zipfile.ZipFile(filename, 'w') as z:
        # 1. mimetype must be uncompressed and first
        z.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        
        # 2. META-INF/container.xml
        container_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>'''
        z.writestr('META-INF/container.xml', container_xml, compress_type=zipfile.ZIP_DEFLATED)
        
        # 3. Chapters
        manifest_items = []
        spine_items = []
        nav_items = []
        
        for idx, (ch_title, ch_content) in enumerate(chapters, 1):
            ch_filename = f"chapter{idx}.xhtml"
            ch_id = f"chap{idx}"
            manifest_items.append(f'<item id="{ch_id}" href="{ch_filename}" media-type="application/xhtml+xml"/>')
            spine_items.append(f'<itemref idref="{ch_id}"/>')
            nav_items.append(f'<li><a href="{ch_filename}">{ch_title}</a></li>')
            
            ch_lang = "kk" if any(c in ch_content for c in "әғқңөұүһіӘҒҚҢӨҰҮҺІ") else language
            xhtml = f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="{ch_lang}" xml:lang="{ch_lang}">
<head>
  <title>{ch_title}</title>
  <meta charset="utf-8"/>
</head>
<body>
  {ch_content}
</body>
</html>'''
            z.writestr(f'OEBPS/{ch_filename}', xhtml, compress_type=zipfile.ZIP_DEFLATED)
            
        # 4. Navigation document (nav.xhtml for EPUB3)
        nav_xhtml = f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{language}">
<head><title>Оглавление</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Оглавление</h1>
    <ol>
      {"".join(nav_items)}
    </ol>
  </nav>
</body>
</html>'''
        z.writestr('OEBPS/nav.xhtml', nav_xhtml, compress_type=zipfile.ZIP_DEFLATED)
        manifest_items.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
        
        # 5. Package manifest (content.opf)
        safe_title = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        safe_creator = creator.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        content_opf = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:{os.path.basename(filename)}</dc:identifier>
    <dc:title>{safe_title}</dc:title>
    <dc:creator>{safe_creator}</dc:creator>
    <dc:language>{language}</dc:language>
  </metadata>
  <manifest>
    {"".join(manifest_items)}
  </manifest>
  <spine>
    {"".join(spine_items)}
  </spine>
</package>'''
        z.writestr('OEBPS/content.opf', content_opf, compress_type=zipfile.ZIP_DEFLATED)

print("Building test EPUBs...")

# Book 1: Нон-фикшн (с точной структурой эталона + Казахский раздел)
ch1_nonfiction = '''
<h1>MAKES YOU LITTLE MONEY, DRAINS YOUR ENERGY</h1>
<p>Tasks in the Delegation Quadrant are menial tasks that are sucking your energy. Think about administrative work, billing, invoicing, setting up travel arrangements, responding to emails, et cetera. I know millionaires who are still performing many of these tasks because they just haven't figured out how to get rid of them. They have beliefs around them that keep them a prisoner of that work. What they don't realize is that they could be much more successful if they just audited their time, transferred those tasks, and filled their day with higher-value and rewarding work. Instead, they're bogged down by the weight of it all.</p>
<p>Tasks in the Delegation Quadrant should be found and quickly moved on to someone else when possible. Think about it this way: If you paid a marketer $100,000 a year, would you want them spending six hours a day cleaning the office windows?</p>
<p>If you're doing tasks that bring in very little money <em>and</em> they're draining you, you have one simple goal: transfer them as quickly as possible.</p>
<p>Once, my marketing team at SaaS Academy came to me with a problem. They needed to transfer a ton of data from one system to another, and it was going to take dozens of staff-hours. My team was really worked up about taking time away from other projects that could make us hundreds of thousands of dollars.</p>
'''

ch2_nonfiction_kz = '''
<h1>КӨШБАСШЫЛЫҚ ПЕН УАҚЫТТЫ БАСҚАРУ</h1>
<p>Әрбір табысты кәсіпкер өз өміріндегі бағалы сағаттарды дұрыс бағалай білуі тиіс. Біз күнделікті күйбең тірлікке беріліп, маңызды мақсаттардан көз жазып қаламыз. Егер сіз өз уақытыңызды тиімді пайдаланбасаңыз, ешқашан үлкен жетістікке жете алмайсыз. Бұл қарапайым қағиданы түсіну өте маңызды.</p>
<p>Қайрат пен жігер, ақыл мен парасат — адам баласының ең негізгі құндылықтары. Білім мен ізденіс жолында ерінбей еңбек еткен тұлға ғана қоғамға нақты пайдасын тигізе алады. Ұлы ойшылдар айтқандай, уақытты бағаламаған жан өз болашағына балта шабады.</p>
<p>Өзгерісті өзіңізден бастаңыз: өнімсіз жұмысты өзгелерге тапсырыңыз, өзіңіз тек құндылық жасайтын стратегиялық бағыттарға көңіл бөліңіз. Сонда ғана ұжымыңыз бен ісіңіз қарқынды дами түседі.</p>
'''

create_epub(
    "storage/epubs/book_epub_nonfiction.epub",
    "Buy Back Your Time: Leadership & Focus",
    "Dan Martell",
    "en",
    [("Delegation Quadrant", ch1_nonfiction), ("Көшбасшылық", ch2_nonfiction_kz)]
)

# Book 2: Проза (Художественная литература)
ch1_prose = '''
<h1>СТЕПНОЙ ВЕТЕР</h1>
<p>На закате степь казалась бескрайним золотым морем. Солнце медленно опускалось за горизонт, окрашивая перистые облака в багровые и пурпурные тона. Вечерний ветерок приносил с гор прохладу и горьковатый аромат полыни. Старый чабан сидел на холме, глядя вдаль, и тихо напевал древнюю песню о батырах и вечной степи.</p>
<p>Лошади мирно паслись в низине у родника, изредка пофыркивая и отгоняя хвостами сумеречных мошек. В юрте неподалеку уже зажгли светильник, и теплый свет пробивался сквозь войлочный полог, обещая горячий чай с лепешками и неспешную вечернюю беседу.</p>
<p>— Пора возвращаться, дедушка, — раздался за спиной звонкий мальчишеский голос. Маленький внук нес в руках берестяной ковш с холодной ключевой водой.</p>
<p>Старик улыбнулся, погладил седую бороду и кивнул. Жизнь продолжалась в своем размеренном, вечном круговороте, не знающем суеты и тревог большого мира.</p>
'''

ch2_prose = '''
<h1>УТРЕННИЙ РАССВЕТ</h1>
<p>Утро наступило неожиданно быстро. Первые лучи солнца коснулись белоснежных вершин Заилийского Алатау, превратив их в сияющие хрустальные пирамиды. Воздух звенел от чистоты и свежести.</p>
<p>В ауле начинался новый трудовой день. Слышался перестук подойников, лай собак и веселые крики ребятишек, спешащих к реке. Каждый день приносил с собой новые надежды и радость простого человеческого бытия.</p>
'''

create_epub(
    "storage/epubs/book_epub_prose.epub",
    "Степные новеллы",
    "Мухтар Ауэзов",
    "ru",
    [("Степной ветер", ch1_prose), ("Утренний рассвет", ch2_prose)]
)

# Book 3: Книга со своей сложной/агрессивной вёрсткой (Custom CSS)
ch1_custom = '''
<h1 style="color: darkmagenta; font-family: monospace; font-size: 32px; text-align: center; border-bottom: 4px dashed orange; padding: 20px;">ГЛАВА С АГРЕССИВНОЙ ВЁРСТКОЙ</h1>
<div style="background-color: lightyellow; padding: 25px; margin: 30px; font-family: 'Comic Sans MS', cursive; font-size: 22px; color: green; line-height: 2.2;">
  <p style="margin-bottom: 40px; text-indent: 50px; color: red;">Этот абзац издатель оформил красным цветом с огромным отступом и шрифтом Comic Sans, но движок Madaq нормализует типографику, сохраняя эстетику и комфорт чтения.</p>
  <p style="color: blue; letter-spacing: 5px;">Второй абзац с синим текстом и неестественным разряженным трекингом. Наша система гарантирует серифную антикву, выравнивание по ширине и правильную красную строку.</p>
</div>
<p style="margin-top: 30px; margin-bottom: 30px; font-size: 14px; color: gray;">Третий абзац с нестандартными вертикальными полями издателя. Правило p + p восстанавливает книжную культуру без бессмысленных интервалов.</p>
<p style="color: #000000; background-color: #ffffff; padding: 10px;">Четвертый абзац с жестко заданным цветом color: #000 и белым фоном #fff. В любой теме оформления он автоматически переопределяется в естественный цвет текста и прозрачный фон темы Madaq.</p>
<table border="1" style="width: 100%; margin: 20px 0; border: 2px solid brown;">
  <tr><th>Параметр</th><th>Значение</th></tr>
  <tr><td>Шрифт</td><td>Literata (Serif)</td></tr>
  <tr><td>Выключка</td><td>Justify (по ширине)</td></tr>
</table>
'''

create_epub(
    "storage/epubs/book_epub_custom_css.epub",
    "Веб-дизайн и стандарты вёрстки",
    "Джеффри Зельдман",
    "ru",
    [("Своя вёрстка", ch1_custom)]
)

print("EPUBs generated successfully in storage/epubs/!")
