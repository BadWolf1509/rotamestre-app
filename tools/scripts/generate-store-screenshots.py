#!/usr/bin/env python3
"""Build Google Play phone screenshots from real Android captures.

The UI pixels are never regenerated: each source capture is only cropped,
resized, rounded, and placed inside a branded 1080x1920 composition.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


CANVAS = (1080, 1920)
NAV_TOP = 2280
STATUS_BOTTOM = 88
BLUE_TOP = (8, 26, 73)
BLUE_BOTTOM = (37, 73, 171)
ORANGE = (247, 149, 12)
WHITE = (255, 255, 255)


DEFAULT_SLIDES = [
    (
        "10-gestor-dashboard.png",
        "01-gestao-em-um-so-lugar.png",
        "GESTÃO INTELIGENTE",
        "Sua operação\nem um só lugar",
    ),
    (
        "11-gestor-nova-rota.png",
        "02-crie-rotas-em-poucos-passos.png",
        "ROTAS E ENTREGAS",
        "Crie entregas\nem poucos passos",
    ),
    (
        "12-gestor-gestao.png",
        "03-acompanhe-a-operacao.png",
        "CONTROLE COMPLETO",
        "Acompanhe toda\na sua operação",
    ),
    (
        "13-gestor-detalhes-rota.png",
        "04-mapa-e-paradas.png",
        "VISÃO EM TEMPO REAL",
        "Visualize a rota\ne cada parada",
    ),
    (
        "22-motorista-paradas.png",
        "05-proxima-parada-a-vista.png",
        "PARA MOTORISTAS",
        "Próxima parada\nsempre à vista",
    ),
    (
        "23-motorista-mapa.png",
        "06-todas-as-paradas-no-mapa.png",
        "MAPA OPERACIONAL",
        "Todas as paradas\nno mapa",
    ),
    (
        "21-motorista-navegacao.png",
        "07-navegue-com-seu-app-favorito.png",
        "NAVEGAÇÃO FLEXÍVEL",
        "Navegue com seu\napp favorito",
    ),
    (
        "28-motorista-ajuda.png",
        "08-ajuda-sempre-a-mao.png",
        "SUPORTE NO CAMINHO",
        "Ajuda sempre\nà mão",
    ),
]


def vertical_gradient(size: tuple[int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    pixels = image.load()
    for y in range(height):
        t = y / max(height - 1, 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(BLUE_TOP, BLUE_BOTTOM))
        for x in range(width):
            pixels[x, y] = color
    return image


def cover_round(image: Image.Image, size: tuple[int, int], radius: int) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    cropped = resized.crop((left, top, left + size[0], top + size[1])).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    cropped.putalpha(mask)
    return cropped


def fit_font(path: str, text: str, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 12:
        font = ImageFont.truetype(path, size)
        bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).multiline_textbbox(
            (0, 0), text, font=font, spacing=0
        )
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(path, 12)


def build_slide(
    source: Path,
    output: Path,
    eyebrow: str,
    headline: str,
    icon_path: Path,
) -> None:
    canvas = vertical_gradient(CANVAS).convert("RGBA")
    draw = ImageDraw.Draw(canvas, "RGBA")

    # Soft brand shapes add depth without competing with the product UI.
    draw.ellipse((820, -160, 1220, 240), fill=(*ORANGE, 32))
    draw.ellipse((-260, 1450, 260, 1970), fill=(255, 255, 255, 15))
    draw.rounded_rectangle((62, 47, 405, 113), radius=33, fill=(255, 255, 255, 28))

    regular_path = r"C:\Windows\Fonts\segoeui.ttf"
    semibold_path = r"C:\Windows\Fonts\seguisb.ttf"
    bold_path = r"C:\Windows\Fonts\segoeuib.ttf"
    eyebrow_font = ImageFont.truetype(semibold_path, 30)
    brand_font = ImageFont.truetype(semibold_path, 27)
    headline_font = fit_font(bold_path, headline, 900, 76)

    icon = Image.open(icon_path).convert("RGB")
    icon = cover_round(icon, (52, 52), 14)
    canvas.alpha_composite(icon, (76, 54))
    draw.text((145, 59), "ROTA MESTRE", font=brand_font, fill=BLUE_TOP)
    draw.text((62, 133), eyebrow, font=eyebrow_font, fill=ORANGE)
    draw.multiline_text((62, 179), headline, font=headline_font, fill=WHITE, spacing=-4)

    source_image = Image.open(source).convert("RGB")
    app_content = source_image.crop((0, STATUS_BOTTOM, source_image.width, NAV_TOP))

    phone_width = 756
    phone_height = round(phone_width * app_content.height / app_content.width)
    screenshot = cover_round(app_content, (phone_width, phone_height), 36)
    phone_x = (CANVAS[0] - phone_width) // 2
    phone_y = CANVAS[1] - phone_height - 22

    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (phone_x - 15, phone_y - 15, phone_x + phone_width + 15, phone_y + phone_height + 15),
        radius=48,
        fill=(0, 0, 0, 145),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas.alpha_composite(shadow)

    draw.rounded_rectangle(
        (phone_x - 9, phone_y - 9, phone_x + phone_width + 9, phone_y + phone_height + 9),
        radius=44,
        fill=WHITE,
    )
    canvas.alpha_composite(screenshot, (phone_x, phone_y))

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--icon", type=Path, required=True)
    args = parser.parse_args()

    missing = [name for name, *_ in DEFAULT_SLIDES if not (args.raw_dir / name).exists()]
    if missing:
        raise SystemExit(f"Missing capture(s): {', '.join(missing)}")

    for source_name, output_name, eyebrow, headline in DEFAULT_SLIDES:
        build_slide(
            args.raw_dir / source_name,
            args.output_dir / output_name,
            eyebrow,
            headline,
            args.icon,
        )
        print(args.output_dir / output_name)


if __name__ == "__main__":
    main()
