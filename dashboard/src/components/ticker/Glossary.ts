export const GLOSSARY: Record<string, { definition: string; example: string }> = {
  "RSI": {
    definition: "Índice de Fuerza Relativa. Mide si una acción está sobrecomprada (cara, todos quieren comprar) o sobrevendida (barata, todos quieren vender). Va de 0 a 100.",
    example: "RSI > 70 = sobrecomprada, señal de cautela. RSI < 30 = sobrevendida, posible oportunidad."
  },
  "SMA": {
    definition: "Media Móvil Simple. Es el precio promedio de los últimos N días. Sirve para ver la tendencia general sin el ruido diario.",
    example: "SMA 200 = $70 y precio actual = $76 → el precio está sobre la media, tendencia alcista."
  },
  "MACD": {
    definition: "Indicador de convergencia/divergencia de medias móviles. Cuando la línea MACD cruza por encima de su señal, es alcista; por debajo, bajista.",
    example: "MACD cruza hacia arriba → muchos traders lo toman como señal de compra."
  },
  "P/E Ratio": {
    definition: "Precio dividido por ganancias por acción. Cuántos años de ganancias pagarías hoy por la empresa. Más alto = más cara.",
    example: "P/E 23x significa que pagas $23 por cada $1 de ganancia anual. El mercado promedia ~20x."
  },
  "P/B Ratio": {
    definition: "Precio vs valor contable. Compara lo que pagas en bolsa con lo que realmente 'vale' la empresa en libros.",
    example: "P/B 9x significa que pagas 9 veces el valor contable — típico en empresas con marcas valiosas."
  },
  "P/FCF": {
    definition: "Precio vs flujo de caja libre. Similar al P/E pero usando el dinero real que genera la empresa, no solo la ganancia contable.",
    example: "P/FCF 20x es razonable. P/FCF 57x significa que la empresa es cara en términos de caja real."
  },
  "FCF Yield": {
    definition: "Rendimiento del flujo de caja libre. Es el % de retorno real que genera la empresa por cada dólar invertido. Más alto = mejor.",
    example: "FCF Yield 4% = por cada $100 invertidos, la empresa genera $4 de caja libre al año."
  },
  "EV/EBITDA": {
    definition: "Valor de empresa vs ganancias antes de impuestos, intereses y depreciación. Compara empresas sin importar cómo se financian.",
    example: "EV/EBITDA 15x es razonable. 22x significa una prima, pero aceptable para empresas estables."
  },
  "ROE": {
    definition: "Retorno sobre el patrimonio. Cuánto gana la empresa por cada peso de los accionistas. Más alto = más eficiente.",
    example: "ROE 43% significa que por cada $100 de capital propio, la empresa genera $43 de ganancia."
  },
  "Margen Neto": {
    definition: "De cada $100 que vende la empresa, cuántos quedan como ganancia final después de todos los costos.",
    example: "Margen neto 27% → de $100 en ventas, quedan $27 de ganancia. Muy bueno para consumo masivo."
  },
  "Margen Bruto": {
    definition: "De cada $100 en ventas, cuánto queda después de solo los costos de producción, antes de gastos operativos.",
    example: "Margen bruto 61% en Coca-Cola refleja el poder de su marca — producir una bebida cuesta muy poco."
  },
  "Deuda/Equity": {
    definition: "Cuánta deuda tiene la empresa en relación a su capital propio. Más bajo = más segura financieramente.",
    example: "D/E 1.3x → por cada $1 de capital propio, la empresa debe $1.30. Moderado pero manejable."
  },
  "Cobertura de Intereses": {
    definition: "Cuántas veces puede la empresa pagar sus intereses de deuda con sus ganancias operativas. Más alto = más segura.",
    example: "Cobertura 9x → la empresa genera 9 veces más de lo que necesita para pagar sus intereses."
  },
  "EPS": {
    definition: "Ganancia por acción. Es la ganancia neta de la empresa dividida entre el número de acciones. Es el 'sueldo' de cada acción.",
    example: "EPS $3.04 → cada acción de KO generó $3.04 de ganancia en el último año."
  },
  "Dividend Yield": {
    definition: "Rendimiento por dividendo. Es el dividendo anual dividido por el precio actual. Es como la 'tasa de interés' que paga la acción.",
    example: "Yield 2.7% → si compras a $76, recibirás ~$2.05 al año en dividendos por acción."
  },
  "Payout Ratio": {
    definition: "Qué porcentaje de sus ganancias reparte la empresa como dividendo. Muy alto (+80%) puede ser insostenible.",
    example: "Payout 67% → de cada $3.04 de ganancia, $2.05 se reparten como dividendo."
  },
  "Graham Number": {
    definition: "Fórmula del legendario inversor Benjamin Graham para estimar el valor máximo que deberías pagar por una acción.",
    example: "Graham Number $22 en KO no significa que valga $22 — Graham era ultraconservador. Úsalo como piso mínimo."
  },
  "Beta": {
    definition: "Mide cuánto se mueve una acción en relación al mercado general. Beta 1 = se mueve igual que el mercado.",
    example: "Beta 0.36 de KO → si el mercado cae 10%, KO cae ~3.6%. Es una acción muy estable."
  },
  "Stop Loss": {
    definition: "Precio mínimo al que venderías para limitar pérdidas. Es una orden automática de protección.",
    example: "Stop loss en $63 → si KO cae a $63, vendes automáticamente y no pierdes más del 18%."
  },
  "Soporte": {
    definition: "Nivel de precio donde históricamente la acción ha parado de caer y rebotado. Es un 'piso' psicológico del mercado.",
    example: "Soporte en $67 → KO ha rebotado varias veces desde ese nivel en los últimos 2 meses."
  },
  "Resistencia": {
    definition: "Nivel de precio donde la acción ha tenido dificultad para seguir subiendo. Es un 'techo' psicológico.",
    example: "Resistencia en $81 → KO no ha logrado superar ese nivel, es el máximo de 52 semanas."
  },
  "Market Cap": {
    definition: "Capitalización de mercado. Es el valor total de la empresa en bolsa: precio × número de acciones.",
    example: "Market Cap $330B → el mercado valora Coca-Cola en $330 mil millones en total."
  },
  "Fair Value": {
    definition: "Valor justo estimado de una acción. Es el precio al que 'debería' cotizar según sus fundamentos, no la emoción del mercado.",
    example: "Fair Value $67 vs precio $76 → la acción está cotizando con una prima del ~14% sobre su valor justo."
  },
}
