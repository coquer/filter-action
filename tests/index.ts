import fs from 'fs';

const file = fs.readFileSync('tests/matrix.json', 'utf8')
const list = JSON.parse(file)

const diff = fs.readFileSync('tests/output.txt', 'utf8')

const filteredList = list.filter(({service}: any) => {
    // @ts-ignore
    return diff.includes(service)
})

const filteredListString = JSON.stringify(filteredList)

console.log(filteredListString)