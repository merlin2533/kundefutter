/**
 * ZUGFeRD / Factur-X PDF Embedding
 *
 * Bettet die Factur-X XML-Rechnung in ein bestehendes PDF als eingebettete
 * Datei ein und ergänzt die notwendigen XMP-Metadaten für PDF/A-3b-Konformität.
 *
 * Profil: Factur-X BASIC WL (urn:factur-x.eu:1p0:basicwl)
 * Standard: ZUGFeRD 2.3 / Factur-X 1.0
 */

import { PDFDocument, AFRelationship, PDFName, PDFDict } from "pdf-lib";

const FACTURX_FILENAME = "factur-x.xml";
const FACTURX_PROFILE_ID = "urn:factur-x.eu:1p0:basicwl";
const FACTURX_CONFORMANCE = "BASIC WL";

/**
 * Erzeugt das XMP-Metadaten-Dokument für PDF/A-3b + Factur-X.
 */
function buildXmpMetadata(rechnungNr: string, datum: Date): string {
  const ts = datum.toISOString();
  // BOM-Zeichen als UTF-8 Bytes
  const bom = "\uFEFF";
  return (
    `<?xpacket begin="${bom}" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    `  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    // Dublin Core
    `    <rdf:Description rdf:about=""\n` +
    `      xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `      <dc:format>application/pdf</dc:format>\n` +
    `      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Rechnung ${rechnungNr}</rdf:li></rdf:Alt></dc:title>\n` +
    `    </rdf:Description>\n` +
    // XMP Basic
    `    <rdf:Description rdf:about=""\n` +
    `      xmlns:xmp="http://ns.adobe.com/xap/1.0/">\n` +
    `      <xmp:CreateDate>${ts}</xmp:CreateDate>\n` +
    `      <xmp:ModifyDate>${ts}</xmp:ModifyDate>\n` +
    `      <xmp:CreatorTool>AGRI-Office</xmp:CreatorTool>\n` +
    `    </rdf:Description>\n` +
    // PDF/A-3b Conformance
    `    <rdf:Description rdf:about=""\n` +
    `      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">\n` +
    `      <pdfaid:part>3</pdfaid:part>\n` +
    `      <pdfaid:conformance>B</pdfaid:conformance>\n` +
    `    </rdf:Description>\n` +
    // Factur-X document metadata
    `    <rdf:Description rdf:about=""\n` +
    `      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">\n` +
    `      <fx:DocumentType>INVOICE</fx:DocumentType>\n` +
    `      <fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>\n` +
    `      <fx:Version>1.0</fx:Version>\n` +
    `      <fx:ConformanceLevel>${FACTURX_CONFORMANCE}</fx:ConformanceLevel>\n` +
    `    </rdf:Description>\n` +
    // PDF/A Extension Schema für Factur-X
    `    <rdf:Description rdf:about=""\n` +
    `      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"\n` +
    `      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"\n` +
    `      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">\n` +
    `      <pdfaExtension:schemas>\n` +
    `        <rdf:Bag>\n` +
    `          <rdf:li rdf:parseType="Resource">\n` +
    `            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>\n` +
    `            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>\n` +
    `            <pdfaSchema:prefix>fx</pdfaSchema:prefix>\n` +
    `            <pdfaSchema:property>\n` +
    `              <rdf:Seq>\n` +
    `                <rdf:li rdf:parseType="Resource">\n` +
    `                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>\n` +
    `                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>\n` +
    `                  <pdfaProperty:category>external</pdfaProperty:category>\n` +
    `                  <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>\n` +
    `                </rdf:li>\n` +
    `                <rdf:li rdf:parseType="Resource">\n` +
    `                  <pdfaProperty:name>DocumentType</pdfaProperty:name>\n` +
    `                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>\n` +
    `                  <pdfaProperty:category>external</pdfaProperty:category>\n` +
    `                  <pdfaProperty:description>INVOICE</pdfaProperty:description>\n` +
    `                </rdf:li>\n` +
    `                <rdf:li rdf:parseType="Resource">\n` +
    `                  <pdfaProperty:name>Version</pdfaProperty:name>\n` +
    `                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>\n` +
    `                  <pdfaProperty:category>external</pdfaProperty:category>\n` +
    `                  <pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description>\n` +
    `                </rdf:li>\n` +
    `                <rdf:li rdf:parseType="Resource">\n` +
    `                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>\n` +
    `                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>\n` +
    `                  <pdfaProperty:category>external</pdfaProperty:category>\n` +
    `                  <pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description>\n` +
    `                </rdf:li>\n` +
    `              </rdf:Seq>\n` +
    `            </pdfaSchema:property>\n` +
    `          </rdf:li>\n` +
    `        </rdf:Bag>\n` +
    `      </pdfaExtension:schemas>\n` +
    `    </rdf:Description>\n` +
    `  </rdf:RDF>\n` +
    `</x:xmpmeta>\n` +
    `<?xpacket end="w"?>`
  );
}

/**
 * Bettet eine Factur-X / ZUGFeRD XML-Datei in einen PDF-Buffer ein.
 *
 * - Setzt AFRelationship: Alternative (Factur-X-Standard)
 * - Dateiname: factur-x.xml
 * - Ergänzt XMP-Metadaten für PDF/A-3b und Factur-X-Identifikation
 *
 * @param pdfBuffer  Ursprünglicher PDF-Buffer (aus jsPDF)
 * @param xmlString  ZUGFeRD / Factur-X XML-Inhalt
 * @param rechnungNr Rechnungsnummer (für XMP-Titel)
 * @param datum      Rechnungsdatum
 */
export async function embedZugferdInPdf(
  pdfBuffer: Buffer,
  xmlString: string,
  rechnungNr: string = "",
  datum: Date = new Date(),
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  // XML als Dateianhang einbetten (AFRelationship: Alternative)
  const xmlBytes = Buffer.from(xmlString, "utf-8");
  await pdfDoc.attach(xmlBytes, FACTURX_FILENAME, {
    mimeType: "application/xml",
    description: `Factur-X BASIC WL — ${FACTURX_PROFILE_ID}`,
    creationDate: datum,
    modificationDate: datum,
    afRelationship: AFRelationship.Alternative,
  });

  // XMP-Metadaten als Stream in den PDF-Catalog schreiben
  const xmpXml = buildXmpMetadata(rechnungNr, datum);
  const xmpBytes = Buffer.from(xmpXml, "utf-8");
  const metadataStream = pdfDoc.context.stream(xmpBytes, {
    Type: "Metadata",
    Subtype: "XML",
  });
  const metadataRef = pdfDoc.context.register(metadataStream);

  // Catalog-Dictionary mit /Metadata aktualisieren
  const catalog = pdfDoc.context.lookup(pdfDoc.catalog) as PDFDict;
  catalog.set(PDFName.of("Metadata"), metadataRef);

  // Dokument-Metadaten setzen
  pdfDoc.setTitle(`Rechnung ${rechnungNr}`);
  pdfDoc.setSubject("ZUGFeRD / Factur-X Rechnung");
  pdfDoc.setCreator("AGRI-Office");
  pdfDoc.setProducer("AGRI-Office (pdf-lib)");
  pdfDoc.setCreationDate(datum);
  pdfDoc.setModificationDate(datum);

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
