# Diretrizes de Marca – Rota Mestre

Estas diretrizes consolidam os padrões de cores, tipografia e contraste que devem ser seguidos em todo o **rotamestre-app** para garantir consistência visual e acessibilidade.

## Paleta oficial

| Uso | Hex | Contexto |
| --- | --- | --- |
| Azul primário | `#284093` | Fundo principal de áreas navegacionais, botões primários, barras e destaques escuros |
| Azul realce | `#34699f` | Estados hover, gradientes, elementos secundários sobre fundo azul |
| Laranja primário | `#f7a02a` | CTA secundários, badges, ícones de atenção |
| Laranja claro | `#ffbf14` | Gradientes, destaque suave em cartões |
| Laranja acento | `#fbad02` | Microelementos (indicadores, ícones) |

### Regras gerais

- **Sempre** usar texto branco (`#FFFFFF`) sobre fundos azuis nos botões/cards.  
- Em fundos laranja aplicar textos brancos, adicionando sombra leve (`rgba(0,0,0,0.25)`) ou peso extra para garantir contraste.
- Quando o texto for laranja sobre fundo azul, utilize peso SemiBold/Bold e sombra branca suave para preservar a leitura.
- Evite misturar azuis e laranjas fora da paleta; gradientes devem respeitar as combinações acima.

## Tipografia

| Fonte | Uso |
| --- | --- |
| **Viga** | Títulos principais (H1/H2), logomarca e seções hero. |
| **Nunito Sans** | Corpo do texto, botões, inputs. Variantes: Light, Regular, Medium, SemiBold, Bold. |
| **Caroni** | Acentos ilustrativos (material promocional). Usar com parcimônia. |

### Boas práticas

- Títulos em Viga devem usar tracking negativo leve e cor `#111827` sobre fundos claros ou branco sobre azul/laranja.
- Para botões e CTAs, usar Nunito Sans SemiBold/Bold com espaçamento consistente (`letter-spacing: 0.5px`).
- Evitar fontes mistas no mesmo elemento. Sempre combinar Viga + Nunito Sans.

## Contraste e sombras

1. **Texto branco em azul**  
   - Certifique-se de que o fundo esteja dentro da faixa `#284093 - #34699f`.  
   - Adicione sombra `rgba(0, 0, 0, 0.15)` quando houver imagem ou gradiente ao fundo.
2. **Texto branco em laranja**  
   - Necessário acrescentar sombra `rgba(0, 0, 0, 0.3)` ou duplicar a camada com leve deslocamento (efeito outline).
3. **Texto laranja em azul**  
   - Utilize o laranja `#fbad02` ou `#ffbf14` em bold, com sombra branca `rgba(255,255,255,0.5)`.

## Componentes de referência

- **Sidebar / Drawer**: Fundo branco, menu ativo em azul primário com texto branco. Logotipo horizontal deve usar margens internas de 24px.
- **Botões primários**: Fundo `#284093`, texto branco, borda none, sombra `0px 4px 16px rgba(40,64,147,0.35)`.
- **Botões secundários**: Fundo `#f7a02a`, texto branco; estados hover com `#c87704`.
- **Cards**: Fundo branco, títulos em Viga `#111827`, badges usando laranja/acento. Se o card for colorido, seguir regra de contraste indicada.

## Checklist de revisão

1. Todas as cores devem vir de `theme.colors` (ver `src/utils/styles.ts`).  
2. Botões e links não podem usar hex fixo fora da paleta.  
3. Verificar que os componentes usam `Nunito Sans`/`Viga` conforme hierarquia.  
4. Aplicar sombra ou peso quando houver texto claro sobre fundos saturados.  
5. Assets como logos devem respeitar margens mínimas e não distorcer proporção.

> Qualquer novo componente deve citar esta diretriz no PR ou documentação, garantindo consistência visual em todas as plataformas (web, iOS, Android).
