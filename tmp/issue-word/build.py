import re
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

source=Path('docs/issues/Frontend-Integration-Handoff.md').read_text(encoding='utf-8-sig')
doc=Document()
section=doc.sections[0]
section.page_width=Inches(8.5); section.page_height=Inches(11)
section.top_margin=section.bottom_margin=Inches(.65)
section.left_margin=section.right_margin=Inches(.65)
for name in ['Normal','Title','Heading 1','Heading 2','List Bullet','List Number']:
    style=doc.styles[name]; style.font.name='Calibri'; style.font.color.rgb=RGBColor(0,0,0)
    style.font.size=Pt(11)
    style.paragraph_format.space_after=Pt(5)
    style.paragraph_format.line_spacing=1.04
for name,size in [('Title',22),('Heading 1',15),('Heading 2',12)]:
    doc.styles[name].font.size=Pt(size)
    doc.styles[name].paragraph_format.keep_with_next=True
    doc.styles[name].paragraph_format.space_before=Pt(10)
doc.styles['Title'].paragraph_format.space_before=Pt(0)
# Remove Word's built-in Title border so the document imports cleanly elsewhere.
title_ppr = doc.styles['Title'].element.get_or_add_pPr()
title_border = title_ppr.find(qn('w:pBdr'))
if title_border is not None:
    title_ppr.remove(title_border)

def inline(p,text,size=None):
    for token in re.split(r'(\*\*.*?\*\*|`[^`]+`)',text):
        r=p.add_run(token[2:-2] if token.startswith('**') else token[1:-1] if token.startswith('`') else token)
        if token.startswith('**'): r.bold=True
        if token.startswith('`'): r.font.name='Consolas'; r.font.size=Pt(size or 9)
        elif size: r.font.size=Pt(size)

def table(rows):
    t=doc.add_table(rows=1,cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    widths=[1.5,3.1,2.37]
    for col,w in zip(t.columns,widths): col.width=Inches(w)
    props=t._tbl.tblPr
    borders=OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        edge=OxmlElement('w:'+side); edge.set(qn('w:val'),'single'); edge.set(qn('w:sz'),'4'); edge.set(qn('w:color'),'D9D9D9'); borders.append(edge)
    props.append(borders)
    margins=OxmlElement('w:tblCellMar')
    for side in ['top','left','bottom','right']:
        el=OxmlElement('w:'+side); el.set(qn('w:w'),'85'); el.set(qn('w:type'),'dxa'); margins.append(el)
    props.append(margins)
    for i,row in enumerate(rows):
        cells=t.rows[0].cells if i==0 else t.add_row().cells
        trpr=t.rows[i]._tr.get_or_add_trPr(); trpr.append(OxmlElement('w:cantSplit'))
        if i==0: trpr.append(OxmlElement('w:tblHeader'))
        for j,(cell,txt) in enumerate(zip(cells,row)):
            cell.width=Inches(widths[j]); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(2); p.paragraph_format.line_spacing=1.0
            inline(p,txt,8.5)
            if i==0:
                shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'E3EBF3'); cell._tc.get_or_add_tcPr().append(shade)
                for run in p.runs: run.bold=True
    doc.add_paragraph().paragraph_format.space_after=Pt(0)

lines=source.splitlines(); i=0
while i<len(lines):
    line=lines[i].strip()
    if not line: i+=1; continue
    if line.startswith('```'):
        i+=1
        while i<len(lines) and not lines[i].strip().startswith('```'):
            p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(0); p.paragraph_format.line_spacing=1
            r=p.add_run(lines[i]); r.font.name='Consolas'; r.font.size=Pt(8.5)
            shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'F3F4F6'); p._p.get_or_add_pPr().append(shade)
            i+=1
        i+=1; continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            row=[s.strip() for s in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[:\-\s]+',v) for v in row): rows.append(row)
            i+=1
        table(rows); continue
    if line.startswith('# '):
        title = doc.add_paragraph('DigiMandal Issues Frontend Integration Handoff','Title')
        title_ppr = title._p.get_or_add_pPr()
        title_border = title_ppr.find(qn('w:pBdr'))
        if title_border is not None:
            title_ppr.remove(title_border)
    elif line.startswith('## '):
        heading=re.sub(r'[^\w\s]',' ',line[3:]).replace('_',' ')
        heading=re.sub(r'\s+',' ',heading).strip()
        doc.add_paragraph(heading,'Heading 1')
    elif line.startswith('- '): inline(doc.add_paragraph(style='List Bullet'),line[2:])
    elif re.match(r'^\d+\. ',line): inline(doc.add_paragraph(style='List Number'),re.sub(r'^\d+\. ','',line))
    else: inline(doc.add_paragraph(),line)
    i+=1

doc.core_properties.title='DigiMandal Issues Frontend Integration Handoff'
doc.core_properties.subject='Screen to API mapping for frontend developers and AI coding agents'
doc.core_properties.author='DigiMandal'
doc.save('docs/issues/Frontend-Integration-Handoff.docx')
print('Saved Word document')
