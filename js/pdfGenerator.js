function pdfGenerator(numberOfTeams, locations, combinations) {
    var combinationsLength = 3; //TODO

    /// create a document and pipe to a blob
    var doc = new PDFDocument();
    var stream = doc.pipe(blobStream());

    doc.fontSize(12);

    doc.moveDown();

    var i;
    for (i = 1; i <= 5; i++) {
        doc.fontSize(24);
        doc.text('Team '+i.toString(), {
            align:'center'
        });
        doc.moveDown(2);
        doc.fontSize(12);
        doc.text('8:05 - Gerts', {
            align: 'left'
        })
        doc.addPage();
    }

    // end and display the document in the iframe to the right
    doc.end();
    stream.on('finish', function() {
        location.href = stream.toBlobURL('application/pdf');
    });
}
