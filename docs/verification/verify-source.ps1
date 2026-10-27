param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('bizinfo', 'mss', 'kstartup')]
    [string] $Source
)

# STEP 2 verification utility; not the production collector.
$ErrorActionPreference = 'Stop'
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskEvidenceDir = Join-Path $taskProjectRoot 'docs/evidence'
[IO.Directory]::CreateDirectory($taskEvidenceDir) | Out-Null
$taskSecrets = @{}
foreach ($taskLine in Get-Content -Encoding UTF8 -LiteralPath (Join-Path $taskProjectRoot '.env.local')) {
    if ($taskLine -match '^([A-Z_]+)=(.*)$') {
        $taskSecrets[$Matches[1]] = $Matches[2].Trim()
    }
}

$taskSettings = @{
    bizinfo = @{ Endpoint = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do'; Variable = 'BIZINFO_API_KEY'; KeyParam = 'crtfcKey' }
    mss = @{ Endpoint = 'https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService'; Variable = 'MSS_API_KEY'; KeyParam = 'serviceKey' }
    kstartup = @{ Endpoint = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01'; Variable = 'KSTARTUP_API_KEY'; KeyParam = 'serviceKey' }
}
$taskConfig = $taskSettings[$Source]
$taskSecret = $taskSecrets[$taskConfig.Variable]
if (-not $taskSecret) { throw "Missing environment variable: $($taskConfig.Variable)" }
$taskUtf8 = [Text.UTF8Encoding]::new($false)
$taskResults = @()

foreach ($taskScenario in @('page1', 'page2', 'empty')) {
    $taskPage = if ($taskScenario -eq 'page2') { '2' } else { '1' }
    $taskQuery = [ordered]@{}
    switch ($Source) {
        bizinfo {
            $taskQuery['dataType'] = 'json'
            $taskQuery['searchCnt'] = '4'
            $taskQuery['pageUnit'] = '2'
            $taskQuery['pageIndex'] = $taskPage
            if ($taskScenario -eq 'empty') { $taskQuery['hashtags'] = 'WithBizVerificationNoMatch20261027' }
        }
        mss {
            $taskQuery['dataType'] = 'json'
            $taskQuery['numOfRows'] = '2'
            $taskQuery['pageNo'] = $taskPage
            if ($taskScenario -eq 'empty') { $taskQuery['pblancId'] = 'PBLN_WITHBIZ_NO_MATCH_20261027' }
        }
        kstartup {
            $taskQuery['returnType'] = 'json'
            $taskQuery['perPage'] = '2'
            $taskQuery['page'] = $taskPage
            if ($taskScenario -eq 'empty') { $taskQuery['cond[biz_pbanc_nm::LIKE]'] = 'WithBizVerificationNoMatch20261027' }
        }
    }
    $taskPublicQuery = @($taskQuery.GetEnumerator() | ForEach-Object {
        [Uri]::EscapeDataString([string]$_.Key) + '=' + [Uri]::EscapeDataString([string]$_.Value)
    }) -join '&'
    $taskUrl = $taskConfig.Endpoint + '?' + $taskPublicQuery + '&' + $taskConfig.KeyParam + '=' + [Uri]::EscapeDataString($taskSecret)
    $taskCheckedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $taskResponse = $null
    try {
        $taskResponse = Invoke-WebRequest -Uri $taskUrl -UseBasicParsing -TimeoutSec 25 -MaximumRedirection 0
        $taskBody = $taskResponse.Content
    } catch {
        $taskStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { $null }
        $taskErrorBody = if ($_.ErrorDetails.Message) { [string]$_.ErrorDetails.Message } else { '' }
        foreach ($taskValue in $taskSecrets.Values) {
            if ($taskValue) { $taskErrorBody = $taskErrorBody.Replace($taskValue, '[REDACTED]') }
        }
        $taskResults += [pscustomobject]@{
            source = $Source; scenario = $taskScenario; checkedAt = $taskCheckedAt
            endpoint = $taskConfig.Endpoint; query = $taskPublicQuery; httpStatus = $taskStatus
            success = $false; errorType = $_.Exception.GetType().FullName; errorBody = $taskErrorBody
        }
        # Auth or transport failures should not produce more equivalent requests.
        break
    }
    foreach ($taskValue in $taskSecrets.Values) {
        if ($taskValue) { $taskBody = $taskBody.Replace($taskValue, '[REDACTED]') }
    }
    $taskFilename = "$Source-$taskScenario.json"
    [IO.File]::WriteAllText((Join-Path $taskEvidenceDir $taskFilename), $taskBody, $taskUtf8)
    try { $taskJson = $taskBody | ConvertFrom-Json } catch {
        $taskResults += [pscustomobject]@{
            source = $Source; scenario = $taskScenario; checkedAt = $taskCheckedAt
            endpoint = $taskConfig.Endpoint; query = $taskPublicQuery; httpStatus = [int]$taskResponse.StatusCode
            success = $false; errorType = 'InvalidJson'; evidence = $taskFilename
        }
        break
    }
    $taskRootFields = @($taskJson.PSObject.Properties.Name)
    $taskEnvelope = if ($taskJson.response) { $taskJson.response } else { $taskJson }
    $taskExpectedSchema = switch ($Source) {
        bizinfo { 'jsonArray' -in $taskRootFields }
        mss { $null -ne $taskEnvelope.body -and $null -ne $taskEnvelope.header }
        kstartup { 'data' -in $taskRootFields -and 'totalCount' -in $taskRootFields }
    }
    $taskNoData = $Source -eq 'mss' -and
        [string]$taskEnvelope.header.resultCode -eq '03' -and
        [string]$taskEnvelope.header.resultMsg -eq 'NODATA_ERROR' -and
        $null -ne $taskEnvelope.body.totalCount -and
        [string]$taskEnvelope.body.totalCount -eq '0'
    $taskApiError = if ($taskJson.reqErr) { [string]$taskJson.reqErr }
        elseif ($taskJson.OpenAPI_ServiceResponse) { [string]$taskJson.OpenAPI_ServiceResponse.cmmMsgHeader.errMsg }
        elseif ($taskEnvelope.header.resultCode -and $taskEnvelope.header.resultCode -notin @('00', '0') -and -not $taskNoData) { [string]$taskEnvelope.header.resultMsg }
        else { $null }
    $taskRecords = @()
    if ($Source -eq 'bizinfo' -and $taskJson.jsonArray) { $taskRecords = @($taskJson.jsonArray) }
    if ($Source -eq 'mss' -and $taskEnvelope.body.items.item) { $taskRecords = @($taskEnvelope.body.items.item) }
    if ($Source -eq 'kstartup') {
        if ($taskJson.data.data) { $taskRecords = @($taskJson.data.data) }
        elseif ($taskJson.data -is [array]) { $taskRecords = @($taskJson.data) }
    }
    $taskIds = @($taskRecords | ForEach-Object {
        if ($Source -eq 'kstartup') { [string]$_.pbanc_sn } else { [string]$_.pblancId }
    })
    $taskFirst = if ($taskRecords.Count -gt 0) { $taskRecords[0] } else { $null }
    $taskTotal = if ($Source -eq 'bizinfo') { $taskFirst.totCnt }
        elseif ($Source -eq 'mss') { $taskEnvelope.body.totalCount }
        else { $taskJson.totalCount }
    $taskResults += [pscustomobject]@{
        source = $Source; scenario = $taskScenario; checkedAt = $taskCheckedAt
        endpoint = $taskConfig.Endpoint; query = $taskPublicQuery; httpStatus = [int]$taskResponse.StatusCode
        success = (-not $taskApiError -and $taskExpectedSchema); apiError = $taskApiError
        expectedSchema = $taskExpectedSchema
        providerResultCode = $taskEnvelope.header.resultCode
        providerResultMessage = $taskEnvelope.header.resultMsg
        emptyResult = $taskNoData
        rootFields = $taskRootFields; recordCount = $taskRecords.Count; totalCount = $taskTotal
        ids = $taskIds; itemFields = @(if ($taskFirst) { $taskFirst.PSObject.Properties.Name })
        sampleTitle = if ($Source -eq 'kstartup') { $taskFirst.biz_pbanc_nm } else { $taskFirst.pblancNm }
        evidence = $taskFilename
    }
    if ($taskApiError) { break }
}
$taskSummary = ConvertTo-Json -InputObject @($taskResults) -Depth 8
[IO.File]::WriteAllText((Join-Path $taskEvidenceDir "$Source-verification.json"), $taskSummary, $taskUtf8)
Write-Output $taskSummary
