'use strict'

const couchPass = require('./couchPass.json')
const url = `http://${couchPass.user}:${couchPass.pass}@127.0.0.1:5984`
const nano = require('nano')(url)
const adb = nano.db.use('artendb_live')
const _ = require('lodash')

let docsWritten = 0

function bulkSave (docs) {
  let bulk = {}
  bulk.docs = docs
  adb.bulk(bulk, function (error, result) {
    if (error) return console.log('error after bulk:', error)
    docsWritten = docsWritten + docs.length
    console.log('docsWritten', docsWritten)
  })
}

function correctTypo (es) {
  /**
   * function gets es that has es.Eigenschaften['Östliches Mitelland (codiert)']
   * it builds a new es with the same order of properties and the typo corrected
   */
  let newEs = _.clone(es)
  Object.keys(es.Eigenschaften).forEach((key) => {
    if (key === 'Östliches Mitelland (codiert)') {
      newEs.Eigenschaften['Östliches Mittelland (codiert)'] = es.Eigenschaften[key]
    } else if (key === 'Östliches Mitelland (uncodiert)') {
      newEs.Eigenschaften['Östliches Mittelland (uncodiert)'] = es.Eigenschaften[key]
    } else {
      newEs.Eigenschaften[key] = es.Eigenschaften[key]
    }
  })
  return newEs
}

adb.view('artendb', 'flora', {
  'include_docs': true
}, (error, body) => {
  if (error) return console.log(error)
  let docs = []
  let docsPrepared = 0
  body.rows.forEach((row, rowIndex) => {
    const doc = row.doc
    let save = false
    if (doc.Gruppe && doc.Eigenschaftensammlungen) {
      let rlO2Index
      const rl02 = doc.Eigenschaftensammlungen.find((es, index) => {
        if (es.Name === 'CH Rote Liste Flora (2002)') {
          rlO2Index = index
          return true
        }
      })
      if (rl02 && rl02.Eigenschaften && rl02.Eigenschaften['Östliches Mitelland (codiert)']) {
        save = true
        const newEs = correctTypo(rl02)
        doc.Eigenschaftensammlungen[rlO2Index] = newEs
      }
      let rlAktuellIndex
      const rlAktuell = doc.Eigenschaftensammlungen.find((es, index) => {
        if (es.Name === 'CH Rote Liste (aktuell)') {
          rlAktuellIndex = index
          return true
        }
      })
      if (rlAktuell && rlAktuell.Eigenschaften && rlAktuell.Eigenschaften['Östliches Mitelland (codiert)']) {
        save = true
        // if both fields exist: remove correct one
        if (rlAktuell.Eigenschaften['Östliches Mittelland (codiert)']) delete rlAktuell.Eigenschaften['Östliches Mittelland (codiert)']
        // now correct wrong one
        const newEs = correctTypo(rlAktuell)
        doc.Eigenschaftensammlungen[rlAktuellIndex] = newEs
      }
    }
    // only save if something was changed
    if (save) docs.push(doc)
    if ((docs.length > 600) || (rowIndex === body.rows.length - 1)) {
      docsPrepared = docsPrepared + docs.length
      console.log('docsPrepared', docsPrepared)
      // save 600 docs
      bulkSave(docs.splice(0, 600))
    }
  })
})
