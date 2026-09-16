# Corpus Normativo Base - LegalProp AI

Este directorio contiene las leyes, decretos y reglamentos internos de ejemplo que componen la base de conocimiento vectorial inicial para el motor RAG de **LegalProp AI**.

## 1. Contenido del Corpus
- `ley_arriendos_ejemplo.md`: Selección de artículos esenciales de la **Ley 820 de 2003** (Régimen de Arrendamiento de Vivienda Urbana en Colombia), incluyendo obligaciones de las partes, cánones, incrementos y causales de terminación.
- `reglamento_ph_ejemplo.md`: Compendio representativo del **Régimen de Propiedad Horizontal** (inspirado en la **Ley 675 de 2001** y manuales de convivencia habituales), abarcando bienes comunes, asambleas de copropietarios, expensas comunes y régimen sancionatorio por ruidos o infracciones.

## 2. Convenciones de Formato para Nuevas Normas
Para asegurar una óptima segmentación semántica mediante `LegalTextSplitter`:
1. Utiliza encabezados con `# Título de la Norma` en el nivel 1.
2. Nombra cada división o artículo con encabezados `### Artículo [N]. [Epígrafe]`.
3. Mantén los parágrafos y numerales indentados dentro del cuerpo de cada artículo.
4. El backend detectará automáticamente los artículos y generará fragmentos preservando el contexto del título normativo.
