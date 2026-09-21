//PARA PANEL DE ADMINISTRADORES ENTRA AL URL Y AGREGA AL FINAL ?panel=asistencia
const SPREADSHEET_ID = '1OJIL_zHEvBRMZVg4vXD3SYe4gcNdSegeD5K1-2-7QkA';
const DRIVE_FOLDER_ID = '1q57EJmQJI3GvAXgfFxY9hW_at08uUiSh';
const API_ADMIN_TOKEN = 'CAMBIA_ESTE_TOKEN_ADMINISTRATIVO';
const QR_SERVICE_URL = 'https://quickchart.io/qr';
const ADMINISTRADORES = [ //ADMINISTRADORES CORREOS
	'sebastiannieblas23@gmail.com'
];

function doGet(e) {
	const esAsistencia = e && e.parameter && e.parameter.panel === 'asistencia';
	return HtmlService.createHtmlOutputFromFile(esAsistencia ? 'registroasistencia' : 'panelregistro')
		.setTitle(esAsistencia ? 'Registro de asistencia' : 'Registro Hela 2027')
		.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
	try {
		const solicitud = JSON.parse(e.postData.contents || '{}');
		const accion = solicitud.accion;

		if (accion === 'registrar') {
			return respuestaJson(registrarParticipante(solicitud.datos || {}));
		}

		if (accion === 'buscarAsistencia') {
			verificarTokenApi(solicitud.token);
			return respuestaJson(buscarAsistencia(solicitud.clave));
		}

		if (accion === 'movimientoAsistencia') {
			verificarTokenApi(solicitud.token);
			return respuestaJson(registrarMovimientoAsistencia(solicitud.clave, solicitud.tipo));
		}

		throw new Error('Acción API no válida.');
	} catch (error) {
		return respuestaJson({ error: error.message || String(error) });
	}
}

function respuestaJson(datos) {
	return ContentService.createTextOutput(JSON.stringify(datos))
		.setMimeType(ContentService.MimeType.JSON);
}

function verificarTokenApi(token) {
	if (!token || token !== API_ADMIN_TOKEN || API_ADMIN_TOKEN === 'CAMBIA_ESTE_TOKEN_ADMINISTRATIVO') {
		throw new Error('Token administrativo no válido.');
	}
}

function autorizarQr() {
	const respuesta = UrlFetchApp.fetch(QR_SERVICE_URL + '?text=AUTORIZACION&size=100', {
		muteHttpExceptions: true
	});
	if (respuesta.getResponseCode() !== 200) {
		throw new Error('No se pudo conectar con el servicio de QR.');
	}
	return 'Permiso para generar QR autorizado correctamente.';
}

function prepararHojaAsistencia() {
	const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
	let sheet = spreadsheet.getSheetByName('PRUEBA ASISTENCIA');
	if (!sheet) {
		sheet = spreadsheet.insertSheet('PRUEBA ASISTENCIA');
	}

	sheet.getRange('A1:E1').setValues([['NOMBRE', 'CLAVE HELA', 'CORREO', 'ENTRADA', 'SALIDA']]);
	return 'Hoja PRUEBA ASISTENCIA lista.';
}

function verificarAdministrador() {
	const correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
	const administradores = ADMINISTRADORES.map(email => email.toLowerCase());
	if (!correo || !administradores.includes(correo)) {
		throw new Error('Acceso restringido. Solo administradores del congreso pueden usar este panel.');
	}
	return { autorizado: true, correo: correo };
}

function buscarAsistencia(clave) {
	verificarAdministrador();
	const claveNormalizada = String(clave || '').trim().toUpperCase();
	if (!claveNormalizada) throw new Error('Escribe una clave HELA.');

	const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
	const asistencia = obtenerHojaAsistencia(spreadsheet);
	const filaAsistencia = buscarFilaPorClave(asistencia, claveNormalizada);
	if (filaAsistencia) return leerRegistroAsistencia(asistencia, filaAsistencia);

	const total = obtenerHojaPorNombre(spreadsheet, 'REGISTRO TOTAL');
	const filaTotal = buscarFilaPorClave(total, claveNormalizada);
	if (!filaTotal) throw new Error('No se encontró un registro confirmado con esa clave.');

	const datos = total.getRange(filaTotal, 1, 1, 3).getValues()[0];
	asistencia.appendRow([datos[0], datos[1], datos[2], '', '']);
	return leerRegistroAsistencia(asistencia, asistencia.getLastRow());
}

function registrarMovimientoAsistencia(clave, tipo) {
	verificarAdministrador();
	if (!['entrada', 'salida'].includes(tipo)) throw new Error('Tipo de movimiento no válido.');

	const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
	const asistencia = obtenerHojaAsistencia(spreadsheet);
	const fila = buscarFilaPorClave(asistencia, String(clave || '').trim().toUpperCase());
	if (!fila) throw new Error('Busca primero una clave HELA válida.');

	const columna = tipo === 'entrada' ? 4 : 5;
	const valorActual = asistencia.getRange(fila, columna).getValue();
	if (valorActual) {
		throw new Error('La ' + tipo + ' ya fue registrada.');
	}

	asistencia.getRange(fila, columna).setValue(new Date());
	return leerRegistroAsistencia(asistencia, fila);
}

function obtenerHojaAsistencia(spreadsheet) {
	let sheet = spreadsheet.getSheetByName('PRUEBA ASISTENCIA');
	if (!sheet) {
		sheet = spreadsheet.insertSheet('PRUEBA ASISTENCIA');
	}
	if (sheet.getRange('A1').getValue() !== 'NOMBRE') {
		sheet.getRange('A1:E1').setValues([['NOMBRE', 'CLAVE HELA', 'CORREO', 'ENTRADA', 'SALIDA']]);
	}
	return sheet;
}

function buscarFilaPorClave(sheet, clave) {
	const claves = sheet.getRange('B:B').getValues().flat().map(valor => String(valor).trim().toUpperCase());
	const indice = claves.indexOf(clave);
	return indice > 0 ? indice + 1 : null;
}

function leerRegistroAsistencia(sheet, fila) {
	const datos = sheet.getRange(fila, 1, 1, 5).getValues()[0];
	return {
		fila: fila,
		nombre: datos[0],
		clave: datos[1],
		correo: datos[2],
		entrada: datos[3] ? datos[3].toISOString() : '',
		salida: datos[4] ? datos[4].toISOString() : ''
	};
}

function instalarTriggerTransferencias() {
	ScriptApp.getProjectTriggers()
		.filter(trigger => trigger.getHandlerFunction() === 'procesarEdicionTransferencia')
		.forEach(trigger => ScriptApp.deleteTrigger(trigger));

	ScriptApp.newTrigger('procesarEdicionTransferencia')
		.forSpreadsheet(SPREADSHEET_ID)
		.onEdit()
		.create();
}

function confirmarTransferenciaPorFila(numeroFila) {
	const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
	const sheet = obtenerHojaPorNombre(spreadsheet, 'REGISTRO TRANSFERENCIA');
	const fila = Number(numeroFila);
	if (!Number.isInteger(fila) || fila < 2) {
		throw new Error('Indica un número de fila válido.');
	}

	confirmarTransferencia(sheet, fila);
	return 'Transferencia confirmada correctamente.';
}

function registrarParticipante(datos) {
	const metodoPago = String(datos.metodoPago || '').trim().toLowerCase();

	if (metodoPago === 'efectivo' && datos.confirmacionEfectivo !== 'CONGRESO2027') {
		throw new Error('La contraseña de confirmación de efectivo es incorrecta.');
	}

	if (metodoPago === 'transferencia' && !datos.comprobanteBase64) {
		throw new Error('Debes adjuntar el comprobante de transferencia.');
	}

	const lock = LockService.getScriptLock();
	lock.waitLock(30000);

	try {
		const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
		const registroTotal = obtenerHojaPorNombre(spreadsheet, 'REGISTRO TOTAL');
		const nombreHojaMetodo = metodoPago === 'efectivo'
			? 'REGISTRO EFECTIVO'
			: metodoPago === 'transferencia'
				? 'REGISTRO TRANSFERENCIA'
				: null;
		const hojaMetodo = nombreHojaMetodo
			? obtenerHojaPorNombre(spreadsheet, nombreHojaMetodo)
			: null;
		const clave = generarClaveUsuario([registroTotal, hojaMetodo]);
		const comprobanteUrl = metodoPago === 'transferencia'
			? guardarComprobante(datos, clave)
			: '';
		const fila = [
			datos.nombre,
			clave,
			datos.correo,
			datos.telefono,
			datos.escuela,
			datos.talla,
			datos.metodoPago,
			1000,
			comprobanteUrl,
			new Date(),
			metodoPago === 'transferencia' ? 'Pendiente' : ''
		];

		if (metodoPago === 'transferencia') {
			agregarFilaRegistro(hojaMetodo, fila, comprobanteUrl);
		} else {
			agregarFilaRegistro(registroTotal, fila, comprobanteUrl);
			if (hojaMetodo) {
				agregarFilaRegistro(hojaMetodo, fila, comprobanteUrl);
			}
		}

		if (metodoPago === 'efectivo') {
			enviarCorreoRegistro({
				nombre: datos.nombre,
				clave: clave,
				correo: datos.correo,
				telefono: datos.telefono,
				escuela: datos.escuela,
				talla: datos.talla,
				metodoPago: datos.metodoPago,
				cantidad: 1000,
				comprobanteUrl: ''
			});
		}

		return { clave: clave };
	} finally {
		lock.releaseLock();
	}
}

function procesarEdicionTransferencia(e) {
	if (!e || !e.range) return;

	const range = e.range;
	if (range.getSheet().getName() !== 'REGISTRO TRANSFERENCIA' || range.getColumn() !== 11 || range.getRow() < 2) return;
	if (String(range.getValue()).trim().toLowerCase() !== 'si') return;

	const lock = LockService.getScriptLock();
	lock.waitLock(30000);
	try {
		try {
			confirmarTransferencia(range.getSheet(), range.getRow());
		} catch (error) {
			range.setValue('ERROR: ' + String(error.message || error).slice(0, 150));
			throw error;
		}
	} finally {
		lock.releaseLock();
	}
}

function confirmarTransferencia(sheetTransferencias, filaTransferencia) {
	const datosFila = sheetTransferencias.getRange(filaTransferencia, 1, 1, 11).getValues()[0];
	const clave = datosFila[1];
	if (!clave) throw new Error('La fila no contiene una clave HELA.');
	const estado = String(datosFila[10] || '').trim().toLowerCase();
	if (estado !== 'si' && estado !== 'pendiente') {
		throw new Error('La fila debe tener SI o Pendiente en la columna K.');
	}

	const spreadsheet = sheetTransferencias.getParent();
	const sheetTotal = obtenerHojaPorNombre(spreadsheet, 'REGISTRO TOTAL');
	const claves = sheetTotal.getRange('B:B').getValues().flat();
	if (claves.includes(clave)) {
		if (estado === 'si') {
			enviarCorreoRegistro({
				nombre: datosFila[0],
				clave: clave,
				correo: datosFila[2],
				telefono: datosFila[3],
				escuela: datosFila[4],
				talla: datosFila[5],
				metodoPago: datosFila[6],
				cantidad: datosFila[7],
				comprobanteUrl: obtenerUrlComprobante(sheetTransferencias, filaTransferencia)
			});
		}
		sheetTransferencias.getRange(filaTransferencia, 11).setValue('CONFIRMADO');
		return;
	}

	const filaTotal = datosFila.slice(0, 10).concat(['SI']);
	agregarFilaRegistro(sheetTotal, filaTotal, obtenerUrlComprobante(sheetTransferencias, filaTransferencia));
	enviarCorreoRegistro({
		nombre: datosFila[0],
		clave: clave,
		correo: datosFila[2],
		telefono: datosFila[3],
		escuela: datosFila[4],
		talla: datosFila[5],
		metodoPago: datosFila[6],
		cantidad: datosFila[7],
		comprobanteUrl: obtenerUrlComprobante(sheetTransferencias, filaTransferencia)
	});
	sheetTransferencias.getRange(filaTransferencia, 11).setValue('CONFIRMADO');
}

function enviarCorreoRegistro(datos) {
	const destinatario = String(datos.correo || '').trim();
	if (!destinatario) {
		throw new Error('El registro no tiene un correo electrónico.');
	}

	const qr = generarQr(datos.clave);
	const asunto = 'Registro Hela 2027 confirmado';
	const cuerpo = [
		'Hola ' + datos.nombre + ',',
		'',
		'Tu registro para Hela 2027 ha sido confirmado.',
		'',
		'Datos del registro:',
		'Nombre: ' + datos.nombre,
		'Correo: ' + datos.correo,
		'Teléfono: ' + datos.telefono,
		'Escuela: ' + datos.escuela,
		'Talla: ' + datos.talla,
		'Método de pago: ' + datos.metodoPago,
		'Cantidad: $' + datos.cantidad,
		'',
		'Tu clave HELA de acceso y uso es: ' + datos.clave,
		'Adjuntamos tu código QR. Preséntalo junto con tu clave HELA.',
		'',
		'Conserva este correo.'
	].filter(Boolean).join('\n');

	const htmlCuerpo = cuerpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
		+ '<br><br><strong>Código QR de acceso</strong><br><img src="cid:qrCode" alt="Código QR HELA" width="300" height="300">';

	MailApp.sendEmail({
		to: destinatario,
		subject: asunto,
		body: cuerpo,
		htmlBody: htmlCuerpo,
		inlineImages: { qrCode: qr },
		attachments: [qr]
	});
}

function generarQr(clave) {
	const url = QR_SERVICE_URL + '?text=' + encodeURIComponent(clave) + '&size=300&margin=2';
	const respuesta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
	if (respuesta.getResponseCode() !== 200) {
		throw new Error('No se pudo generar el código QR.');
	}

	return respuesta.getBlob().setName('QR-' + clave + '.png');
}

function obtenerUrlComprobante(sheet, fila) {
	const richText = sheet.getRange(fila, 9).getRichTextValue();
	return richText ? richText.getLinkUrl() || '' : '';
}

function agregarFilaRegistro(sheet, fila, comprobanteUrl) {
	if (!sheet.getRange(1, 11).getValue()) {
		sheet.getRange(1, 11).setValue('ESTADO TRANSFERENCIA');
	}

		sheet.appendRow(fila);

		if (comprobanteUrl) {
			const filaNueva = sheet.getLastRow();
			const enlace = SpreadsheetApp.newRichTextValue()
				.setText('Abrir comprobante')
				.setLinkUrl(comprobanteUrl)
				.build();
			sheet.getRange(filaNueva, 9).setRichTextValue(enlace);
		}
}

function guardarComprobante(datos, clave) {
		if (DRIVE_FOLDER_ID === 'PEGA_AQUI_EL_ID_DE_LA_CARPETA_DRIVE') {
			throw new Error('Falta configurar el ID de la carpeta de Drive.');
		}

		const partes = datos.comprobanteBase64.split(',');
		const bytes = Utilities.base64Decode(partes[1] || partes[0]);
		const nombreOriginal = String(datos.comprobanteNombre || 'comprobante-transferencia').replace(/[^a-zA-Z0-9._-]/g, '_');
		const nombreArchivo = 'Comprobante-' + clave + '-' + nombreOriginal;
		const blob = Utilities.newBlob(bytes, datos.comprobanteMimeType || 'image/jpeg', nombreArchivo);
		const archivo = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);

		return archivo.getUrl();
}

function obtenerHojaPorNombre(spreadsheet, nombre) {
		const sheet = spreadsheet.getSheetByName(nombre);

		if (!sheet) {
			throw new Error('No existe la hoja: ' + nombre);
		}

		return sheet;
}

function generarClaveUsuario(sheets) {
	const clavesRegistradas = sheets.filter(Boolean).reduce((claves, sheet) => {
		return claves.concat(sheet.getRange('B:B').getValues().flat());
	}, []);
	let clave;

	do {
		const numero = Math.floor(10000 + Math.random() * 90000);
		clave = 'HELA-' + numero;
	} while (clavesRegistradas.includes(clave));

	return clave;
}
